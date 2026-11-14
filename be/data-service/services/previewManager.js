// Quản lý web do AI sinh ra: cấp cổng, build+chạy, tắt web cũ, lấy log lỗi.
// Dùng docker CLI qua /var/run/docker.sock (chạy trên chính Docker của máy Ubuntu).
const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const runModel = require('../models/runModel');

const OUTPUTS = process.env.OUTPUTS_DIR || '/app/outputs';
const PORT_MIN = parseInt(process.env.PREVIEW_PORT_MIN || '7000', 10);
const PORT_MAX = parseInt(process.env.PREVIEW_PORT_MAX || '7100', 10);

const projectName = (runId) => `run_${runId}`;
const projectDir = (runId) => path.join(OUTPUTS, projectName(runId));

function sh(args, opts = {}) {
  return new Promise((resolve) => {
    execFile('docker', args, { maxBuffer: 20 * 1024 * 1024, timeout: opts.timeout || 600000, cwd: opts.cwd }, (err, stdout, stderr) =>
      resolve({ ok: !err, out: `${stdout || ''}\n${stderr || ''}`.trim() })
    );
  });
}

// Tắt 1 project (kèm xóa volume DB) để trả lại cổng + RAM
async function stopRun(runId) {
  const dir = projectDir(runId);
  if (fs.existsSync(path.join(dir, 'docker-compose.yml'))) {
    await sh(['compose', '-p', projectName(runId), 'down', '-v', '--remove-orphans'], { cwd: dir, timeout: 120000 });
  }
  await runModel.update(runId, { status: 'stopped', port: null });
}

// Tắt TẤT CẢ web cũ đang chạy (trừ run hiện tại)
async function stopAllExcept(exceptId) {
  const list = await runModel.running();
  for (const r of list) if (r.id !== exceptId) await stopRun(r.id);
}

async function allocatePort() {
  const used = new Set(await runModel.usedPorts());
  for (let p = PORT_MIN; p <= PORT_MAX; p++) if (!used.has(p)) return p;
  throw new Error('Hết cổng preview trống');
}

function writeEnv(runId, port) {
  const env = [`COMPOSE_PROJECT_NAME=${projectName(runId)}`, `PORT_WEB=${port}`, 'DB_ROOT_PASS=rootpass', 'DB_NAME=shop', `JWT_SECRET=jwt_${runId}_${Date.now()}`].join('\n');
  fs.writeFileSync(path.join(projectDir(runId), '.env'), env + '\n');
}

// Build + chạy; trả về báo cáo để Tester (AI) đọc.
async function buildAndStart(runId) {
  const dir = projectDir(runId);
  if (!fs.existsSync(path.join(dir, 'docker-compose.yml'))) {
    return { ok: false, errors: [{ file: 'docker-compose.yml', message: 'Không tìm thấy docker-compose.yml' }], log: '' };
  }
  const run = await runModel.get(runId);
  await stopAllExcept(runId);
  await sh(['compose', '-p', projectName(runId), 'down', '-v', '--remove-orphans'], { cwd: dir, timeout: 120000 });

  const port = run.port || (await allocatePort());
  writeEnv(runId, port);
  await runModel.update(runId, { port, project_name: projectName(runId), status: 'starting' });

  const up = await sh(['compose', '-p', projectName(runId), 'up', '-d', '--build'], { cwd: dir });
  if (!up.ok) {
    return { ok: false, errors: parseErrors(up.out), log: tail(up.out) };
  }

  // Chờ web trả lời HTTP (tối đa ~90s)
  const alive = await waitHttp(`http://host.docker.internal:${port}`, 90).catch(() => false);
  const health = alive || (await waitHttp(`http://172.17.0.1:${port}`, 30).catch(() => false));
  if (!health) {
    const logs = await sh(['compose', '-p', projectName(runId), 'logs', '--tail', '80'], { cwd: dir });
    return { ok: false, errors: parseErrors(logs.out), log: tail(logs.out) };
  }
  await runModel.update(runId, { status: 'running', finished_at: new Date() });
  return { ok: true, errors: [], log: tail(up.out), port };
}

async function waitHttp(url, seconds) {
  for (let i = 0; i < seconds; i += 3) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(3000) });
      if (r.status < 500) return true;
    } catch (e) {}
    await new Promise((r) => setTimeout(r, 3000));
  }
  return false;
}

const tail = (s, n = 4000) => (s.length > n ? s.slice(-n) : s);

// Rút gọn log thành danh sách lỗi gắn theo file (cho Developer sửa đúng chỗ)
function parseErrors(log) {
  const errors = [];
  const seen = new Set();
  const lines = log.split('\n');
  const re = /((?:api|web|db)\/[\w./\-\[\]]+\.(?:jsx?|json|sql|css|html|js))(?::(\d+))?/;
  for (const line of lines) {
    if (!/error|cannot|failed|unexpected|syntax|not found|denied|ERR!/i.test(line)) continue;
    const m = line.match(re);
    const file = m ? m[1] : '(chung)';
    const key = file + line.slice(0, 80);
    if (seen.has(key)) continue;
    seen.add(key);
    errors.push({ file, message: line.trim().slice(0, 300) });
    if (errors.length >= 12) break;
  }
  if (!errors.length) errors.push({ file: '(chung)', message: tail(log, 600) });
  return errors;
}

module.exports = { projectName, projectDir, stopRun, stopAllExcept, allocatePort, buildAndStart };
