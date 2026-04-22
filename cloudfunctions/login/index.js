const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  if (!openid) {
    return { code: 401, msg: '未获取到用户信息' }
  }

  // 查找或创建用户
  const userRes = await db.collection('users').where({ openid }).get()

  let user
  if (userRes.data.length === 0) {
    // 新用户，创建记录
    const newUser = {
      openid,
      nickName: '',
      avatarUrl: '',
      createdAt: db.serverDate(),
      updatedAt: db.serverDate()
    }
    const addRes = await db.collection('users').add({ data: newUser })
    user = { _id: addRes._id, ...newUser }
  } else {
    user = userRes.data[0]
  }

  // 查找用户所在家庭
  const familyRes = await db.collection('families').where({
    'members.openid': openid
  }).get()

  return {
    code: 200,
    data: {
      openid,
      user,
      family: familyRes.data[0] || null
    }
  }
}
