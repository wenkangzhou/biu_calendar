import { initCloud, login } from './utils/cloud'

export interface IAppOption {
  globalData: {
    userInfo?: any
    openid?: string
    family?: any
    memberMap?: Record<string, any>
  }
  initLogin: () => Promise<void>
}

App<IAppOption>({
  globalData: {
    userInfo: null,
    openid: '',
    family: null,
    memberMap: {}
  },

  async onLaunch() {
    // 初始化云开发
    const ok = initCloud()
    if (!ok) return

    // 尝试自动登录
    await this.initLogin()
  },

  async initLogin() {
    try {
      const res: any = await login()
      if (res.code === 200) {
        this.globalData.openid = res.data.openid
        this.globalData.userInfo = res.data.user
        this.globalData.family = res.data.family

        // 构建成员映射表
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
