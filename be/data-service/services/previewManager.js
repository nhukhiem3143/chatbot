// Preview manager: Docker Compose build, startup, diagnostics, and safe retries.
const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const runModel = require('../models/runModel');

const OUTPUTS = process.env.OUTPUTS_DIR || '/app/outputs';
const PORT_MIN = Number.parseInt(process.env.PREVIEW_PORT_MIN || '7000', 10);
const PORT_MAX = Number.parseInt(process.env.PREVIEW_PORT_MAX || '7100', 10);
const LBL = 'com.docker.compose.project';
const projectName = (runId) => `run_${runId}`;
const projectDir = (runId) => path.join(OUTPUTS, projectName(runId));
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const tail = (value, n = 6000) => String(value || '').slice(-n);

function sh(args, opts = {}) {
  return new Promise((resolve) => {
    execFile('docker', args, {
      maxBuffer: 20 * 1024 * 1024,
      timeout: opts.timeout ?? 900000,
      cwd: opts.cwd,
    }, (err, stdout, stderr) => resolve({
      ok: !err,
      code: err?.code ?? 0,
      signal: err?.signal ?? null,
      killed: err?.killed ?? false,
      errorMessage: err?.message ?? '',
      out: `${stdout || ''}\n${stderr || ''}`.trim(),
    }));
  });
}

async function listPreviewProjects() {
  const r = await sh(['ps', '-a', '--format', `{{.Label "${LBL}"}}`]);
  if (!r.ok) throw new Error(`Không liệt kê được Docker projects: ${tail(r.out, 700)}`);
  return [...new Set(r.out.split('\n').map((s) => s.trim()).filter((s) => /^run_\d+$/.test(s)))];
}

async function usedHostPorts() {
  const r = await sh(['ps', '--format', '{{.Ports}}']);
  if (!r.ok) throw new Error(`Không đọc được Docker ports: ${tail(r.out, 700)}`);
  const used = new Set();
  for (const match of r.out.matchAll(/:(\d+)->/g)) used.add(Number(match[1]));
  return used;
}

async function isRunning(runId) {
  const r = await sh(['ps', '-q', '--filter', `label=${LBL}=${projectName(runId)}`,
    '--filter', 'label=com.docker.compose.service=web', '--filter', 'status=running']);
  return r.ok && /[0-9a-f]{6,}/.test(r.out);
}

// Preserve volumes by default. Use removeVolumes only for an explicit reset.
async function removeProject(name, { removeVolumes = false } = {}) {
  if (!/^run_\d+$/.test(name)) throw new Error('Invalid preview project name');
  const dir = projectDir(Number(name.slice(4)));
  const hasCompose = fs.existsSync(path.join(dir, 'docker-compose.yml'));
  if (hasCompose) {
    const args = ['compose', '-p', name, 'down', '--remove-orphans'];
    if (removeVolumes) args.push('-v');
    const down = await sh(args, { cwd: dir, timeout: 120000 });
    if (!down.ok) console.warn('[preview] compose down:', tail(down.out, 600));
  }
  const left = await sh(['ps', '-aq', '--filter', `label=${LBL}=${name}`]);
  if (!left.ok) throw new Error(`Không tìm được container còn lại: ${tail(left.out, 500)}`);
  const ids = left.out.split('\n').map((s) => s.trim()).filter((s) => /^[0-9a-f]{6,}$/.test(s));
  if (ids.length) {
    const removed = await sh(['rm', '-f', ...ids]);
    if (!removed.ok) throw new Error(`Không xóa được container: ${tail(removed.out, 500)}`);
  }
}

async function stopRun(runId) {
  await removeProject(projectName(runId));
  await runModel.update(runId, { status: 'stopped', port: null });
}

async function stopAllExcept(exceptId) {
  for (const name of await listPreviewProjects()) {
    if (name !== projectName(exceptId)) await removeProject(name);
  }
  for (const run of await runModel.running()) {
    if (run.id !== exceptId) await runModel.update(run.id, { status: 'stopped', port: null });
  }
}

async function allocatePort(skip = new Set()) {
  const used = new Set([...(await runModel.usedPorts()).map(Number), ...(await usedHostPorts()), ...skip]);
  for (let p = PORT_MIN; p <= PORT_MAX; p++) if (!used.has(p)) return p;
  throw new Error('Hết cổng preview trống');
}

function writeEnv(runId, port) {
  const file = path.join(projectDir(runId), '.env');
  const entries = fs.existsSync(file) ? fs.readFileSync(file, 'utf8').split(/\r?\n/) : [];
  const values = new Map();
  for (const line of entries) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (m) values.set(m[1], m[2]);
  }
  values.set('COMPOSE_PROJECT_NAME', projectName(runId));
  values.set('PORT_WEB', String(port));
  if (!values.has('DB_ROOT_PASS')) values.set('DB_ROOT_PASS', 'rootpass');
  if (!values.has('DB_NAME')) values.set('DB_NAME', 'shop');
  if (!values.has('JWT_SECRET')) values.set('JWT_SECRET', require('crypto').randomBytes(32).toString('hex'));
  fs.writeFileSync(
    file,
    [...values].map(([k, v]) => `${k}=${v}`).join('\n') + '\n',
    { mode: 0o640 }
  );
}

const INFRA = [
  /failed to fetch anonymous token/i,
  /failed to authorize[^\n]*docker/i,
  /(?:auth|registry-1)\.docker\.io[^\n]*(?:timeout|failed|refused|unavailable|error)/i,
  /toomanyrequests/i, /temporary failure in name resolution/i,
  /no such host/i, /network is unreachable/i,
  /cannot connect to the docker daemon/i, /docker daemon is not running/i,
  /TLS handshake timeout/i, /i\/o timeout/i,
  /failed to resolve source metadata.*(?:docker\.io|timeout)/i,
];
const PORT_ERROR = /port is already allocated|address already in use|bind: address already in use/i;
function infrastructure(log) { return INFRA.some((re) => re.test(log)); }

function parseErrors(log) {
  const value = String(log || '');
  if (infrastructure(value)) {
    return [{ file: '(hạ tầng)', message: `Docker registry / mạng / daemon gặp lỗi:\n${tail(value, 2000)}` }];
  }
  if (PORT_ERROR.test(value)) {
    return [{ file: '(hạ tầng)', message: `Cổng host đang bị chiếm:\n${tail(value, 1500)}` }];
  }
  const lines = value.split(/\r?\n/);
  const errors = [];
  const seen = new Set();
  const fileRe = /(?:^|[\s('"/])((?:web|api|db)\/[\w.\-\/[\]]+\.(?:jsx?|tsx?|json|sql|css|html|vue|py)|docker-compose\.ya?ml|(?:web|api)\/Dockerfile)(?::(\d+)(?::\d+)?)?/i;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!/error|cannot|failed|unexpected|syntax|not found|denied|ERR!|traceback/i.test(line)) continue;
    const context = lines.slice(Math.max(0, i - 2), Math.min(lines.length, i + 5)).join('\n');
    const match = context.match(fileRe);
    const file = match ? match[1] : '(chung)';
    const key = `${file}:${line.trim()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    errors.push({ file, message: tail(context, 1300) });
    if (errors.length >= 10) break;
  }
  if (!errors.length) errors.push({ file: '(chung)', message: tail(value, 1800) || 'Không có log lỗi' });
  return errors;
}

async function waitHttp(url, seconds) {
  const deadline = Date.now() + seconds * 1000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(2500), redirect: 'manual' });
      if (response.status >= 200 && response.status < 400) return true;
    } catch (_) { /* retry */ }
    await sleep(3000);
  }
  return false;
}

async function buildAndStart(runId) {
  const dir = projectDir(runId);
  if (!fs.existsSync(path.join(dir, 'docker-compose.yml'))) {
    return { ok: false, errors: [{ file: 'docker-compose.yml', message: 'Không tìm thấy docker-compose.yml' }], log: '' };
  }
  try {
    await stopAllExcept(runId);
    // Reuse the same named volumes and persistent .env during repair cycles.
    await removeProject(projectName(runId));
    const skip = new Set();
    let port = await allocatePort(skip);
    let up;
    for (let attempt = 0; attempt < 3; attempt++) {
      writeEnv(runId, port);
      await runModel.update(runId, { port, project_name: projectName(runId), status: 'starting' });
      up = await sh(['compose', '-p', projectName(runId), 'up', '-d', '--build'], { cwd: dir, timeout: 900000 });
      if (up.ok || !PORT_ERROR.test(up.out)) break;
      skip.add(port);
      await removeProject(projectName(runId));
      if (attempt < 2) port = await allocatePort(skip);
    }
    if (!up.ok) {
      const fullLog = `${up.errorMessage || ''}\n${up.out}`;
      console.error('[preview] Docker build/up failed:', JSON.stringify({
        runId, exitCode: up.code, signal: up.signal, killed: up.killed,
        errorMessage: up.errorMessage, tail: tail(up.out, 12000)
      }));
      const errors = up.killed
        ? [{ file: '(hạ tầng)', message: `Docker CLI bị timeout/killed: ${up.errorMessage}` }]
        : parseErrors(fullLog);
      return { ok: false, errors, log: tail(fullLog, 12000) };
    }
    const urls = [`http://host.docker.internal:${port}`, `http://172.17.0.1:${port}`];
    let healthy = false;
    for (const url of urls) {
      if (await waitHttp(url, 45)) { healthy = true; break; }
    }
    if (!healthy) {
      const logs = await sh(['compose', '-p', projectName(runId), 'logs', '--tail', '150'], { cwd: dir });
      const combined = `${up.out}\n${logs.out}\nPreview HTTP health check failed at port ${port}`;
      return { ok: false, errors: parseErrors(combined), log: tail(combined) };
    }
    await runModel.update(runId, { status: 'running', finished_at: new Date() });
    return { ok: true, errors: [], log: tail(up.out), port };
  } catch (err) {
    const message = `Preview manager exception: ${err.message}`;
    return { ok: false, errors: [{ file: '(hạ tầng)', message }], log: message };
  }
}

async function reconcile() {
  for (const run of await runModel.running()) {
    const dir = projectDir(run.id);
    if (!fs.existsSync(path.join(dir, 'docker-compose.yml')) || !run.port) {
      await runModel.update(run.id, { status: 'stopped', port: null });
      continue;
    }
    await runModel.update(run.id, { status: 'starting' });
    const up = await sh(['compose', '-p', projectName(run.id), 'up', '-d'], { cwd: dir, timeout: 300000 });
    if (!up.ok || !(await isRunning(run.id))) {
      console.warn(`[reconcile] run_${run.id} failed:`, tail(up.out, 500));
      await runModel.update(run.id, { status: 'stopped', port: null });
    } else {
      await runModel.update(run.id, { status: 'running' });
    }
  }
}

module.exports = { projectName, projectDir, stopRun, stopAllExcept, allocatePort, buildAndStart, reconcile, isRunning, listPreviewProjects, usedHostPorts, removeProject, parseErrors };
