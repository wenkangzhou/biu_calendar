const { all, run, get } = require('./db')
const { sendSubscribeMessage } = require('./utils/wx')

const TMPL_ID = 'NUejq84LuZ3CzlnoKnaDN-YczktShhR-71EWRCIs4F4'

async function checkAndSendReminders() {
  try {
    const now = new Date()
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000)

    const rows = await all(
      `SELECT * FROM events WHERE reminders LIKE '%"enabled":true%' AND start_time > ? AND start_time <= ?`,
      [now.toISOString(), tomorrow.toISOString()]
    )

    for (const row of rows) {
      const reminders = JSON.parse(row.reminders || '{}')
      if (!reminders.enabled || reminders.sent) continue

      try {
        const creator = await get('SELECT * FROM users WHERE openid = ?', [row.creator_openid])
        const fmt = (d) => {
          // 数据库里是 UTC，手动转东八区显示，不依赖服务器本地时区
          const date = new Date(d)
          const offset = 8 * 60 * 60 * 1000
          const local = new Date(date.getTime() + offset)
          const y = local.getUTCFullYear()
          const m = String(local.getUTCMonth() + 1).padStart(2, '0')
          const day = String(local.getUTCDate()).padStart(2, '0')
          const h = String(local.getUTCHours()).padStart(2, '0')
          const min = String(local.getUTCMinutes()).padStart(2, '0')
          return `${y}-${m}-${day} ${h}:${min}`
        }

        await sendSubscribeMessage(row.creator_openid, TMPL_ID, '/pages/index/index', {
          name1: { value: creator && creator.nick_name ? creator.nick_name : '家人' },
          thing3: { value: row.title.trim().slice(0, 20) },
          time13: { value: fmt(row.start_time) },
          time14: { value: fmt(row.end_time) }
        })

        await run('UPDATE events SET reminders = ? WHERE id = ?', [
          JSON.stringify({ ...reminders, sent: true }),
          row.id
        ])

        console.log(`[提醒] 已发送: ${row.title} (${row.start_time})`)
      } catch (err) {
        console.error(`[提醒] 发送失败: ${row.title}`, err.message)
      }
    }
  } catch (err) {
    console.error('[提醒] 检查失败', err)
  }
}

function startScheduler() {
  checkAndSendReminders()
  setInterval(checkAndSendReminders, 5 * 60 * 1000)
  console.log('⏰ 提醒定时任务已启动 (每5分钟)')
}

module.exports = { startScheduler }
