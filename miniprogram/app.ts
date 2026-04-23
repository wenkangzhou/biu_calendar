import { login, getToken } from './utils/api'

export interface IAppOption {
  globalData: {
    userInfo?: any
    openid?: string
    family?: any
    memberMap?: Record<string, any>
  }
  initLogin?: () => Promise<void>
  loginPromise?: Promise<void>
}

App<IAppOption>({
  globalData: {
    userInfo: null,
    openid: '',
    family: null,
    memberMap: {}
  },

  onLaunch() {
    // 如果没有 token，触发登录；有 token 则复用
    if (!getToken()) {
      this.loginPromise = this.initLogin!()
    }
  },

  async initLogin() {
    try {
      const wxRes: any = await new Promise((resolve, reject) => {
        wx.login({ success: resolve, fail: reject })
      })

      if (!wxRes.code) {
        console.error('微信登录失败', wxRes)
        return
      }

      const res: any = await login(wxRes.code)
      if (res.code === 200) {
        this.globalData.openid = res.data.openid
        this.globalData.userInfo = res.data.user
        this.globalData.family = res.data.family
        wx.setStorageSync('openid', res.data.openid)

        if (res.data.family && res.data.family.members) {
          const map: Record<string, any> = {}
          res.data.family.members.forEach((m: any) => {
            map[m.openid] = m
          })
          this.globalData.memberMap = map
        }
      }
    } catch (err) {
      console.error('登录失败', err)
    }
  }
})
