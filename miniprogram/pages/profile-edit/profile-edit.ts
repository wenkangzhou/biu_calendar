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
    if (user?.nick_name) {
      this.setData({ nickName: user.nick_name })
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
    const { nickName } = this.data
    if (!nickName) {
      wx.showToast({ title: '请输入昵称', icon: 'none' })
      return
    }
    // TODO: 调用后端更新用户信息
    wx.showToast({ title: '保存成功', icon: 'success' })
    setTimeout(() => wx.navigateBack(), 800)
  },

  onSkip() {
    wx.navigateBack()
  }
})
