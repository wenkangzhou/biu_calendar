/**
 * 云开发工具函数
 */

const CLOUD_ENV = '' // 如需指定环境ID，请填入；空字符串则使用默认环境

export function initCloud() {
  if (!wx.cloud) {
    console.error('请使用 2.2.3 或以上的基础库以使用云能力')
    return false
  }
  wx.cloud.init({
    env: CLOUD_ENV || undefined,
    traceUser: true
  })
  return true
}

export function callCloudFunction(name: string, data: any = {}): Promise<any> {
  return new Promise((resolve, reject) => {
    wx.cloud.callFunction({
      name,
      data,
      success: (res: any) => {
        if (res.result && res.result.code !== 200) {
          reject(new Error(res.result.msg || '请求失败'))
        } else {
          resolve(res.result)
        }
      },
      fail: (err: any) => {
        reject(err)
      }
    })
  })
}

// 用户相关
export const login = () => callCloudFunction('login')

// 家庭相关
export const createFamily = (data: { name: string; nickName: string; identityTag?: string }) =>
  callCloudFunction('family', { action: 'create', ...data })

export const joinFamily = (data: { inviteCode: string; nickName: string; identityTag?: string }) =>
  callCloudFunction('family', { action: 'join', ...data })

export const getFamily = () =>
  callCloudFunction('family', { action: 'get' })

export const refreshInviteCode = (familyId: string) =>
  callCloudFunction('family', { action: 'refreshInviteCode', familyId })

export const leaveFamily = (familyId: string) =>
  callCloudFunction('family', { action: 'leave', familyId })

// 日程相关
export const createEvent = (data: any) =>
  callCloudFunction('event', { action: 'create', ...data })

export const updateEvent = (data: any) =>
  callCloudFunction('event', { action: 'update', ...data })

export const deleteEvent = (eventId: string) =>
  callCloudFunction('event', { action: 'delete', eventId })

export const getEvent = (eventId: string) =>
  callCloudFunction('event', { action: 'get', eventId })

export const getMonthlyEvents = (familyId: string, year: number, month: number) =>
  callCloudFunction('event', { action: 'getMonthly', familyId, year, month })

export const getDailyEvents = (familyId: string, date: string) =>
  callCloudFunction('event', { action: 'getDaily', familyId, date })
