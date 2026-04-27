// 全局配置：审核模式开关
const REVIEW_MODE = process.env.REVIEW_MODE === '1' || process.env.REVIEW_MODE === 'true'

function isReviewMode() {
  return REVIEW_MODE
}

module.exports = { isReviewMode, REVIEW_MODE }
