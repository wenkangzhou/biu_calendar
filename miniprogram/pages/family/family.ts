import { createFamily, joinFamily, getFamily, refreshInviteCode, leaveFamily } from '../../utils/api'

const app = getApp<IAppOption>()

Page({
  data: {
    family: null as any,
    hasFamily: false,
    showCreate: false,
    showJoin: false,
    createName: '',
    createNickName: '',
    createIdentity: '其他',
    joinCode: '',
    joinNickName: '',
    joinIdentity: '其他',
    loading: true
  },

  async onLoad() {
    await this.loadFamily()
  },

  async loadFamily() {
    try {
      const res: any = await getFamily()
      if (res.code === 200) {
        app.globalData.family = res.data
        const map: Record<string, any> = {}
        res.data.members.forEach((m: any) => { map[m.openid] = m })
        app.globalData.memberMap = map
        this.setData({
          family: res.data,
          hasFamily: true,
          loading: false
        })
      } else {
        this.setData({ hasFamily: false, loading: false })
      }
    } catch (err) {
      this.setData({ hasFamily: false, loading: false })
    }
  },

  onCreateNameChange(e: any) { this.setData({ createName: e.detail.value }) },
  onCreateNickChange(e: any) { this.setData({ createNickName: e.detail.value }) },
  onCreateIdentityChange(e: any) { this.setData({ createIdentity: e.detail.value }) },
  onJoinCodeChange(e: any) { this.setData({ joinCode: e.detail.value }) },
  onJoinNickChange(e: any) { this.setData({ joinNickName: e.detail.value }) },
  onJoinIdentityChange(e: any) { this.setData({ joinIdentity: e.detail.value }) },

  toggleCreate() {
    this.setData({ showCreate: !this.data.showCreate, showJoin: false })
  },

  toggleJoin() {
    this.setData({ showJoin: !this.data.showJoin, showCreate: false })
  },

  async doCreate() {
    const { createName, createNickName, createIdentity } = this.data
    if (!createName || !createNickName) {
      wx.showToast({ title: '请填写完整信息', icon: 'none' })
      return
    }
    wx.showLoading({ title: '创建中' })
    try {
      const res: any = await createFamily({
        name: createName,
        nickName: createNickName,
        identityTag: createIdentity
      })
      if (res.code === 200) {
        wx.showToast({ title: '创建成功', icon: 'success' })
        await this.loadFamily()
        this.setData({ showCreate: false })
        const pages = getCurrentPages()
        if (pages.length > 1) {
          const prev = pages[pages.length - 2] as any
          if (prev && prev.loadFamilyAndEvents) prev.loadFamilyAndEvents()
        }
      } else {
        wx.showToast({ title: res.msg || '创建失败', icon: 'none' })
      }
    } catch (err: any) {
      wx.showToast({ title: err.message || '创建失败', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  },

  async doJoin() {
    const { joinCode, joinNickName, joinIdentity } = this.data
    if (!joinCode || !joinNickName) {
      wx.showToast({ title: '请填写完整信息', icon: 'none' })
      return
    }
    wx.showLoading({ title: '加入中' })
    try {
      const res: any = await joinFamily({
        inviteCode: joinCode,
        nickName: joinNickName,
        identityTag: joinIdentity
      })
      if (res.code === 200) {
        wx.showToast({ title: '加入成功', icon: 'success' })
        await this.loadFamily()
        this.setData({ showJoin: false })
        const pages = getCurrentPages()
        if (pages.length > 1) {
          const prev = pages[pages.length - 2] as any
          if (prev && prev.loadFamilyAndEvents) prev.loadFamilyAndEvents()
        }
      } else {
        wx.showToast({ title: res.msg || '加入失败', icon: 'none' })
      }
    } catch (err: any) {
      wx.showToast({ title: err.message || '加入失败', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  },

  async onRefreshCode() {
    const { family } = this.data
    if (!family) return
    wx.showLoading({ title: '刷新中' })
    try {
      const res: any = await refreshInviteCode({ familyId: family._id })
      if (res.code === 200) {
        wx.showToast({ title: '已刷新', icon: 'success' })
        await this.loadFamily()
      }
    } catch (err: any) {
      wx.showToast({ title: err.message || '刷新失败', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  },

  onCopyCode() {
    const { family } = this.data
    if (!family) return
    wx.setClipboardData({
      data: family.inviteCode,
      success: () => wx.showToast({ title: '邀请码已复制', icon: 'none' })
    })
  },

  async onLeave() {
    const { family } = this.data
    if (!family) return
    wx.showModal({
      title: '确认退出',
      content: '退出后将无法查看家庭日程，确定吗？',
      success: async (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '处理中' })
          try {
            const ret: any = await leaveFamily({ familyId: family._id })
            if (ret.code === 200) {
              wx.showToast({ title: '已退出', icon: 'success' })
              app.globalData.family = null
              app.globalData.memberMap = {}
              this.setData({ family: null, hasFamily: false })
            } else {
              wx.showToast({ title: ret.msg || '操作失败', icon: 'none' })
            }
          } catch (err: any) {
            wx.showToast({ title: err.message || '操作失败', icon: 'none' })
          } finally {
            wx.hideLoading()
          }
        }
      }
    })
  },

  formatDate(iso: string) {
    const d = new Date(iso)
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
  }
})
