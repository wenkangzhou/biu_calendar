const axios = require('axios')

let accessToken = null
let tokenExpireAt = 0

async function getAccessToken() {
  if (accessToken && Date.now() < tokenExpireAt - 60000) {
    return accessToken
  }

  const appid = process.env.WX_APPID
  const secret = process.env.WX_SECRET

  if (!appid || !secret) {
    throw new Error('缺少 WX_APPID 或 WX_SECRET 环境变量')
  }

  const res = await axios.get('https://api.weixin.qq.com/cgi-bin/token', {
    params: {
      grant_type: 'client_credential',
      appid,
      secret
    },
    timeout: 10000
  })

  if (res.data.access_token) {
    accessToken = res.data.access_token
    tokenExpireAt = Date.now() + res.data.expires_in * 1000
    return accessToken
  }

  throw new Error(res.data.errmsg || '获取 access_token 失败')
}

/**
 * 发送订阅消息
 * @param {string} openid
 * @param {string} templateId
 * @param {string} page
 * @param {object} data
 */
async function sendSubscribeMessage(openid, templateId, page, data) {
  const token = await getAccessToken()
  const res = await axios.post(
    `https://api.weixin.qq.com/cgi-bin/message/subscribe/send?access_token=${token}`,
    {
      touser: openid,
      template_id: templateId,
      page,
      data
    },
    { timeout: 10000 }
  )

  if (res.data.errcode !== 0) {
    throw new Error(`[${res.data.errcode}] ${res.data.errmsg}`)
  }

  return res.data
}

module.exports = { getAccessToken, sendSubscribeMessage }
