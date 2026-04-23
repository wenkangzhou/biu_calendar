import { updateUser } from '../../utils/api'

const app = getApp<any>()

const EMOJI_LIST = [
  '😊', '😄', '🥰', '😎', '🤗',
  '👨', '👩', '👴', '👵', '🧑',
  '👧', '👶', '🐱', '🐶', '🌸'
]

const EMOJI_COLORS = [
  '#7DD3C0', '#F8A5C2', '#FCE38A', '#C8A8E9', '#95E1D3',
  '#F38BA8', '#FFB6B9', '#A8E6CF', '#DDA0DD', '#FFD3B6',
  '#A0E7E5', '#FFDAC1', '#B4F8C8', '#E2F0CB', '#FF9AA2'
]

Page({
  data: {
    emojiList: EMOJI_LIST.map((emoji, i) => ({ emoji, color: EMOJI_COLORS[i], index: i })),
    selectedIndex: 0,
    nickName: '',
    previewName: '未设置昵称'
  },

  onLoad() {
    const user = app.globalData.userInfo
    if (user && user.nick_name) {
      this.setData({
        nickName: user.nick_name,
        previewName: user.nick_name
      })
    }
    if (user && user.avatar_url) {
      const idx = EMOJI_LIST.indexOf(user.avatar_url)
      if (idx !== -1) {
        this.setData({ selectedIndex: idx })
      }
    }
  },

  onSelectEmoji(e: any) {
    const { index } = e.currentTarget.dataset
    this.setData({ selectedIndex: index })
  },

  onNickNameChange(e: any) {
    const nickName = e.detail.value.trim()
    this.setData({
      nickName,
      previewName: nickName || '未设置昵称'
    })
  },

  async onSubmit() {
    const { nickName, selectedIndex } = this.data
    if (!nickName) {
      wx.showToast({ title: '请输入昵称', icon: 'none' })
      return
    }
    wx.showLoading({ title: '保存中' })
    try {
      const avatarUrl = EMOJI_LIST[selectedIndex]
      const res: any = await updateUser({ nickName, avatarUrl })
      if (res.code === 200) {
        app.globalData.userInfo = res.data
        wx.showToast({ title: '保存成功', icon: 'success' })
        setTimeout(() => wx.navigateBack(), 800)
      } else {
        wx.showToast({ title: res.msg || '保存失败', icon: 'none' })
      }
    } catch (err: any) {
      wx.showToast({ title: err.message || '保存失败', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  },

  onSkip() {
    wx.navigateBack()
  }
})
