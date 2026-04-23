import { getFamily, getToken, getEventStats, updateUser } from '../../utils/api'
import { SUBSCRIBE_TMPL_ID } from '../../config'

const app = getApp<any>()

Page({
  data: {
    user: null as any,
    family: null as any,
    hasFamily: false,
    myColor: '#7DD3C0',
    stats: {
      total: 0,
      today: 0,
      todo: 0
    }
  },

  async onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 2 })
    }
    if (!getToken() && app.loginPromise) {
      await app.loginPromise
    }
    const openid = app.globalData.openid || wx.getStorageSync('openid')
    const memberMap = app.globalData.memberMap || {}
    const myMember = memberMap[openid]
    this.setData({
      user: app.globalData.userInfo,
      myColor: myMember ? myMember.color : '#7DD3C0'
    })
    await this.loadFamily()
    this.calcStats()
  },

  async loadFamily() {
    try {
      const res: any = await getFamily()
      if (res.code === 200) {
        app.globalData.family = res.data
        this.setData({ family: res.data, hasFamily: true })
      } else {
        this.setData({ hasFamily: false })
      }
    } catch (err) {
      this.setData({ hasFamily: false })
    }
  },

  async calcStats() {
    try {
      const res: any = await getEventStats()
      if (res.code === 200) {
        this.setData({ stats: res.data })
      }
    } catch (err) {
      console.error('加载统计数据失败', err)
    }
  },

  onEditProfile() {
    wx.navigateTo({ url: '/pages/profile-edit/profile-edit' })
  },

  onGoFamily() {
    wx.switchTab({ url: '/pages/family/family' })
  },

  onClearCache() {
    wx.showModal({
      title: '清理缓存',
      content: '确定要清理本地缓存吗？',
      success: (res) => {
        if (res.confirm) {
          wx.clearStorageSync()
          wx.showToast({ title: '已清理', icon: 'success' })
          setTimeout(() => wx.reLaunch({ url: '/pages/index/index' }), 800)
        }
      }
    })
  },

  async onSubscribe() {
    if (!SUBSCRIBE_TMPL_ID) {
      wx.showModal({
        title: '提示',
        content: '订阅消息需要在微信公众平台申请模板ID后使用。请先登录微信公众平台申请一次性订阅消息模板，然后将模板ID填入 miniprogram/config.ts 中。',
        showCancel: false
      })
      return
    }

    try {
      const res: any = await new Promise((resolve, reject) => {
        wx.requestSubscribeMessage({
          tmplIds: [SUBSCRIBE_TMPL_ID],
          success: resolve,
          fail: reject
        })
      })

      const status = res[SUBSCRIBE_TMPL_ID]
      if (status === 'accept') {
        // 用户同意，同步到后端
        try {
          await updateUser({ subscribed: true })
        } catch (e) { /* 忽略后端同步错误 */ }
        wx.setStorageSync('subscribed', true)
        wx.showToast({ title: '订阅成功', icon: 'success' })
      } else if (status === 'reject') {
        wx.showToast({ title: '你已取消订阅', icon: 'none' })
      } else if (status === 'ban') {
        wx.showModal({
          title: '订阅被禁用',
          content: '请前往小程序设置页面打开订阅消息权限',
          showCancel: false
        })
      }
    } catch (err: any) {
      if (err.errCode === 20001) {
        wx.showModal({
          title: '订阅失败',
          content: '请先在设置中打开订阅消息权限',
          showCancel: false
        })
      } else {
        wx.showToast({ title: err.errMsg || '订阅失败', icon: 'none' })
      }
    }
  },

  onShareAppMessage() {
    return {
      title: '家庭共享日历',
      path: '/pages/index/index'
    }
  }
})
