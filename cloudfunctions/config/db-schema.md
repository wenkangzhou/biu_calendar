# 数据库集合说明

## 1. users（用户集合）

```json
{
  "openid": "string",
  "nickName": "string",
  "avatarUrl": "string",
  "createdAt": "date",
  "updatedAt": "date"
}
```

**权限**：仅创建者可读写（用户数据隐私）

---

## 2. families（家庭集合）

```json
{
  "name": "string",
  "creatorOpenid": "string",
  "members": [
    {
      "openid": "string",
      "nickName": "string",
      "identityTag": "string",
      "color": "string",
      "role": "string (creator/admin/member)",
      "joinedAt": "date"
    }
  ],
  "inviteCode": "string",
  "inviteCodeExpireAt": "date",
  "createdAt": "date",
  "updatedAt": "date"
}
```

**权限**：所有用户可读，仅创建者可写

---

## 3. events（日程集合）

```json
{
  "familyId": "string",
  "creatorOpenid": "string",
  "title": "string",
  "type": "string (personal/family)",
  "participants": ["string"],
  "isAllDay": "boolean",
  "startTime": "date",
  "endTime": "date",
  "repeatRule": "object|null",
  "location": "string",
  "remark": "string",
  "tag": "string",
  "visibility": "string (private/family)",
  "reminders": ["object"],
  "isDone": "boolean",
  "createdAt": "date",
  "updatedAt": "date"
}
```

**权限**：所有用户可读，仅创建者可写

---

## 索引建议

在腾讯云开发控制台手动创建以下索引：

1. **events 集合**：
   - `{ familyId: 1, startTime: 1 }` — 按月查询
   - `{ familyId: 1, startTime: 1, endTime: 1 }` — 按日查询
   - `{ creatorOpenid: 1 }` — 用户日程查询

2. **families 集合**：
   - `{ "members.openid": 1 }` — 用户家庭查询
   - `{ inviteCode: 1 }` — 邀请码查询

## 权限配置步骤

在微信开发者工具 -> 云开发 -> 数据库 -> 集合设置中：

1. 创建以上三个集合
2. 设置权限为"所有用户可读，仅创建者可写"（云函数有admin权限，可绕过）
