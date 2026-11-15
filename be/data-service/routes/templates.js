// Trả danh sách template + skill design (hỏi sang AI service)
const router = require('express').Router();
const axios = require('axios');
const { ok, fail, wrap } = require('../utils/response');

router.get('/', wrap(async (req, res) => {
  try {
    const r = await axios.get(`${process.env.AI_URL || 'http://ai:8000'}/templates`, { timeout: 10000 });
    return ok(res, r.data);
  } catch (e) {
    return fail(res, 'Không lấy được templates từ AI service', 502);
  }
}));

module.exports = router;
