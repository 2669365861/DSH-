# DSH 加密锁（dsh-lockbox）

给 DeepSeek Harness 桌面版加一道**启动密码门**：

- **启动即锁定**：DSH 每次启动/刷新都在锁定状态，全屏锁屏盖住整个界面并接管焦点，密码验证通过前无法操作界面。
- **忘记密码**：通过预先绑定的恢复邮箱收取 6 位验证码，验证后设置新密码，再用新密码解锁。
- **界面内加密模式**：解锁后左侧栏底部（与设置同一排）有锁形图标按钮，点击即立即锁屏；设置页也提供「立即锁定」。
- **自动锁定**：默认 30 分钟无操作自动锁定，可选 5 / 15 / 30 / 60 / 120 分钟。
- **安全设置页**：修改密码、更换恢复邮箱、配置/测试 SMTP、调整自动锁定时间、退出所有会话。
- **可选宿主门禁**：默认关闭；在 `config.json` 里写 `"enforceApi": true` 后，锁定时宿主会以 `423 Locked` 拦截所有 `/api` 请求（代价见「已知限制」）。

> **边界说明**：这里的「加密模式」是**访问锁**（锁住 DSH 界面与 API），不是对磁盘上的会话文件做透明加密。它用于防止他人随手打开你的 DSH；不能抵御拥有你 Windows 账户/管理员权限、能直接读取文件的攻击者。详见「安全模型」。

---

## 环境要求

- DeepSeek Harness 桌面版 `0.2.1-rc.3`（`0.2.0-rc.1/rc.2`、`0.2.1-rc.2` 也声明兼容）
- Node.js 18+（仅安装/测试/离线重置脚本需要；DSH 自带运行时）
- 一个可发信的 SMTP 邮箱（QQ / 163 / Gmail / Outlook 或自建）

插件本身**零 npm 依赖**，密码哈希、AES-GCM、SMTP 客户端都用 Node 内置模块实现。

---

## 安装

本插件是标准的 DSH bundle（Host + 浏览器客户端双半侧），运行时零 npm 依赖。

### 方式 A：作为本地 `file:` 依赖安装（推荐）

把插件目录作为本地包安装进 profile，等价于插件市场安装：

```powershell
$profileDir = Join-Path $(if ($env:DSH_HOME) { $env:DSH_HOME } else { Join-Path $HOME '.dsh' }) 'profiles\desktop'
cd $profileDir
pnpm add "file:F:\AI\AI日常工作区\dsh-lockbox"
```

然后把 `dsh-lockbox` 加进 profile `package.json` 的 `dsh.profile.bundles`（见下一节）。

> 安装后 `node_modules\dsh-lockbox` 是**副本**，不是联接。之后修改源码要重新同步（`pnpm add` 一次或手动复制），再重启 DSH 才生效。

### 方式 B：目录联接

不想让 pnpm 打包复制时，用目录联接直接挂载源码（路径按实际位置修改）：

```powershell
$dshHome = if ($env:DSH_HOME) { $env:DSH_HOME } else { Join-Path $HOME '.dsh' }
$profileDir = Join-Path $dshHome 'profiles\desktop'
$pluginDir = 'F:\AI\AI日常工作区\dsh-lockbox'

New-Item -ItemType Directory -Force -Path (Join-Path $profileDir 'node_modules') | Out-Null
cmd /c mklink /J "$profileDir\node_modules\dsh-lockbox" "$pluginDir"
```

如果目标已存在，先删除旧的联接（不要删除真实插件目录）：

```powershell
cmd /c rmdir "$profileDir\node_modules\dsh-lockbox"
```

### 把插件加入 profile 的 bundle 清单

编辑 `C:\Users\<你>\.dsh\profiles\desktop\package.json`，在 `dsh.profile.bundles` 数组末尾加入 `"dsh-lockbox"`：

```json
{
  "dsh": {
    "profile": {
      "bundles": [
        "...",
        "dsh-lockbox"
      ]
    }
  }
}
```

或用 Node 一行（在 PowerShell 里把 `$profileDir` 换成实际路径）：

```powershell
node -e "const fs=require('fs');const p=process.argv[1];const j=JSON.parse(fs.readFileSync(p,'utf8'));const b=j.dsh.profile.bundles;if(!b.includes('dsh-lockbox'))b.push('dsh-lockbox');fs.writeFileSync(p,JSON.stringify(j,null,2)+'\n')" "$profileDir\package.json"
```

> 只改 `bundles` 即可，不需要在用户层 `cordis.patch.yml` 里再插入插件；bundle 自带的 `cordis.patch.yml` 会完成插入。不要给 `id:` 行加行尾注释。

### 重启 DSH

完全退出 DSH 桌面版再启动（不是刷新页面）。首次启动会看到初始化向导。

> 如果是在 DSH 运行中安装/启用插件：锁屏组件只对新加载的页面生效，已打开的页面还没有锁屏。**手动按一次 `Ctrl+R` 刷新页面**即可加载锁屏；重启应用同样可以。

### 4. 首次设置

1. 设置一个至少 8 位的密码（建议 12 位以上，不要复用其他账号密码）。
2. 填写恢复邮箱；忘记密码时验证码会发到这里。
3. 配置 SMTP：
   - **QQ 邮箱**：`smtp.qq.com`，端口 `465`，安全方式 `SSL`，账号填完整邮箱，密码填 **SMTP 授权码**（不是 QQ 登录密码）。
   - **163 邮箱**：`smtp.163.com`，端口 `465`，`SSL`，密码填 **客户端授权码**。
   - **Gmail**：`smtp.gmail.com`，端口 `465`，`SSL`，密码填 **应用专用密码**（需先开启两步验证）。
   - **Outlook / Microsoft 365**：`smtp.office365.com`，端口 `587`，`STARTTLS`，密码填应用密码（若租户禁用 SMTP AUTH 则无法使用）。
   - **自建**：按服务商提供的主机、端口、加密方式填写。
4. 建议点「发送测试邮件」确认 SMTP 可用，再完成设置。
5. 首次设置成功后会直接进入已解锁状态（因为设置者就是本人）。之后每次启动都需要密码。

---

## 使用

### 解锁

启动 DSH 后，锁屏显示密码输入框。输入正确密码后：

- 写入当前标签页的 `sessionStorage` 解锁令牌；
- 页面重载，锁屏消失；
- 之后每 45 秒心跳一次，超过自动锁定时间无操作会自动重新锁定。

关闭标签页/浏览器不会让 Host 立即锁定；Host 端会话按空闲时间过期。需要立刻离开时，点左侧栏底部的「加密模式」图标或设置页的「立即锁定」。

### 忘记密码

1. 在锁屏点「忘记密码」。
2. 点「发送验证码」。验证码只会发到已绑定的恢复邮箱（界面显示掩码地址），不会发给客户端指定的其他地址。
3. 输入 6 位验证码和新密码。验证码 10 分钟内有效；60 秒内不能重复发送；同一验证码最多尝试 5 次。
4. 重置成功后仍保持锁定，必须用**新密码**登录。

> 为避免邮箱枚举，无论邮箱是否匹配，发送接口都返回通用的成功提示；只有配置的恢复邮箱会真正收到邮件。

### 加密模式（立即锁定）

- 解锁后，左侧栏底部（设置按钮同排）出现锁形图标按钮，悬停显示「加密模式」。点击即调用 `POST /dsh-lockbox-7347/lock`，清空当前标签页令牌并回到锁屏。
- 也可以在「设置 → 锁屏与加密 → 立即锁定」操作。
- 默认只锁界面；若在 `config.json` 里开启 `"enforceApi": true`，锁定时宿主还会以 `423 Locked` 拦截所有 `/api` 请求。

### 设置页

「设置 → 安全」中可以：

- 查看恢复邮箱（掩码）、自动锁定时间、SMTP 主机、配置目录；
- 修改密码（需要当前密码；成功后强制重新登录）；
- 更换恢复邮箱（需要当前密码）；
- 修改 SMTP（授权码留空表示不修改；可勾选清除已保存密码）；
- 发送测试邮件；
- 调整自动锁定时间；
- 立即锁定。

---

## 安全模型

### 做了什么

- 密码只保存 **scrypt** 哈希（`N=32768, r=8, p=1`，16 字节随机盐，64 字节输出），不保存明文。
- SMTP 密码使用 **AES-256-GCM** 加密，密钥保存在同目录的 `secret.key`（32 字节随机值）。
- 解锁会话只存在 Host 进程内存中；token 是 32 字节随机值，服务端只保存其 SHA-256；进程重启即全部失效。
- 解锁失败限流：15 分钟内 5 次失败后逐步延迟（60 秒起，指数退避，封顶 30 分钟）。
- 验证码只保存 HMAC-SHA256 哈希；10 分钟过期、60 秒重发冷却、15 分钟最多 5 封、最多 5 次尝试。
- 锁屏是全屏遮罩，盖住整个界面、接管焦点，未验证前点不到任何业务控件。
- 宿主 `connection/request` 上保留可选门禁：`enforceApi: true` 时锁定的确返回 `423`（默认关闭，原因见「已知限制」）。
- 插件路由不在 `/api` 下，所以登录/找回接口在锁定时仍可用；客户端静态资源走 `/plugins`，不受影响。

### 不能做什么

- **不是磁盘加密**：会话记录、工作区文件、插件配置仍以明文存放。能读取你 Windows 用户目录的人可以读取它们。
- **不能抵御本机管理员**：拥有文件读写权限的人可以删除插件、替换代码、删除配置，或运行离线重置脚本。
- **恢复邮箱是信任根**：邮箱被攻破、SMTP 授权码泄露，攻击者可以重置密码。请给邮箱开启两步验证，并使用独立的 SMTP 授权码。
- **门禁默认关闭**：DSH 外壳和官方客户端插件在启动时通过 `/api` 读取持久化状态，锁定时返回 `423` 会让 `dsh-client-locale` 失败、几十个插件停在 pending，桌面窗口直接报「could not start」。所以默认只锁界面；`enforceApi: true` 会在冷启动时带来同样的风险，除非你确认当前插件组合不需要。
- **门禁若要覆盖 HTTP `/api`**：当前 Web 端 RPC 走 HTTP；独立 WebSocket upgrade 不经过该瀑布。
- **前端锁屏不是密码学边界**：能改浏览器代码、能读磁盘、能删配置的本机用户总能绕过；它防止的是「别人坐到你的电脑前」。删掉 `config.json` 会回到向导，重新设密码即可使用 DSH——这是本地自包含锁的固有边界。

### 数据位置

默认：

```
C:\Users\<你>\.dsh\dsh-lockbox\config.json
C:\Users\<你>\.dsh\dsh-lockbox\secret.key
```

如果设置了 `DSH_HOME`，则在 `%DSH_HOME%\dsh-lockbox\`。

`config.json` 包含密码哈希、恢复邮箱、SMTP 配置（密码为密文）、自动锁定分钟数、时间戳。`secret.key` 是 SMTP 密码的加密密钥；**两者要一起备份/一起删除**，只留 `config.json` 会导致 SMTP 密码无法解密。

---

## 忘记密码且邮箱不可用：离线重置

这是本机应急通道，需要能登录 Windows 并访问 DSH 配置目录：

```powershell
cd F:\AI\AI日常工作区\dsh-lockbox
node .\bin\reset.mjs
```

按提示输入两次新密码（终端隐藏输入）。可选同时更换恢复邮箱：

```powershell
node .\bin\reset.mjs --email new-address@example.com
```

脚本会：

- 校验配置存在且完整；
- 用同样的 scrypt 参数生成新哈希；
- 原子写回 `config.json`，保留 SMTP、`secret.key`、自动锁定设置；
- 提示你重启 DSH。

> **运行中的 DSH 不会热加载新配置**。重置后必须完全退出并重启 DSH。离线重置本身不要求旧密码——这正是它作为「本机应急」的意义，也意味着能访问这些文件的人可以重置密码。

如果连脚本也无法使用，最后的兜底是：从 profile 的 `dsh.profile.bundles` 移除 `dsh-lockbox`（或删除 junction），重启 DSH，即可恢复无锁启动；之后可重新安装并设置。此操作会失去锁保护，请仅在确认环境安全时使用。

---

## 卸载

1. 完全退出 DSH。
2. 从 `C:\Users\<你>\.dsh\profiles\desktop\package.json` 的 `dsh.profile.bundles` 中删除 `"dsh-lockbox"`。
3. 删除目录联接（不要删真实插件目录）：

   ```powershell
   cmd /c rmdir "C:\Users\<你>\.dsh\profiles\desktop\node_modules\dsh-lockbox"
   ```

4. 如不再需要凭据，删除 `C:\Users\<你>\.dsh\dsh-lockbox\`。
5. 重启 DSH。

---

## 故障排查

### 启动后没有锁屏

- 确认 profile `package.json` 的 `dsh.profile.bundles` 含 `dsh-lockbox`，且 `node_modules\dsh-lockbox` 联接指向真实目录。
- 确认已完全退出并重启 DSH（刷新页面不够）。
- 打开开发者工具 Console，检查是否有 `dsh-lockbox` 相关加载错误；确认 `window.__ModuleLoader__` 存在。
- 查看 Host 日志中是否有 `[dsh-lockbox]` 开头的错误。配置损坏时锁屏会显示修复提示，而不是静默放行。

### 收不到验证码

- 在设置页点「发送测试邮件」，看返回的具体 SMTP 错误。
- QQ/163 必须用**授权码**，不是登录密码；Gmail 必须用应用专用密码。
- 检查端口与加密方式是否匹配（465=SSL，587=STARTTLS，25=明文；很多服务商封 25）。
- 检查垃圾邮件箱；确认恢复邮箱拼写正确。
- 若 SMTP 密码曾变更，进入设置页重新填写并保存。

### 忘记密码，邮箱也不可用

使用上面的 `bin/reset.mjs` 离线重置。

### 配置损坏 / `secret.key` 丢失

- 如果只是 `secret.key` 丢失：SMTP 密码无法解密，进入设置页重新填写 SMTP 授权码即可；密码哈希和邮箱不受影响。
- 如果 `config.json` 损坏：锁屏会提示配置损坏并拒绝用空配置覆盖。备份后删除 `config.json`（以及可选的 `secret.key`），重启 DSH 重新初始化；这会丢失旧密码和 SMTP 设置。

### 启动后锁屏不出现 / 桌面窗口报「could not start」

先确认客户端 bundle 有没有加载：浏览器开发者工具 Network 里应能看到 `client.js`（200）。如果界面正常但没锁屏，按一次 `Ctrl+R`。

如果桌面窗口弹「The application could not start」并列出大量 `pending (waiting for service: locale)`，说明客户端启动图被卡住了——不要开 `enforceApi`，并把插件保持在默认（只锁界面）模式。

### 需要更硬的宿主门禁

在 `C:\Users\<你>\.dsh\dsh-lockbox\config.json` 里加 `"enforceApi": true`（或设环境变量 `DSH_LOCKBOX_ENFORCE_API=1` 临时验证），重启后锁定时 `/api` 返回 `423`。注意：这会阻断启动期客户端插件对 `/api` 的读取，冷启动可能失败；仅在确认插件组合可接受时使用。

---

## 开发与测试

```powershell
cd F:\AI\AI日常工作区\dsh-lockbox
node --test test/*.test.js
```

测试覆盖（8 个用例，全部通过）：

- `test/store.test.js`：初始化落盘/重载后仍锁定、错误密码与连续失败限流、会话心跳与设置鉴权、改密、邮箱验证码重置（重置后旧会话全部失效）、密码强度校验；
- `test/gate.test.js`：默认模式下 `/api` 放行（保证客户端能启动）；`enforceApi` 模式下 `/api` 返回 `423`、静态资源与插件路由始终放行；以及 setup/unlock/lock、错误密码 `401`、无令牌访问设置接口 `401`。

SMTP 传输（SSL/STARTTLS/明文、AUTH LOGIN/PLAIN、超时）由 `lib/smtp.js` 内置实现；上线前建议在初始化向导里点一次「发送测试邮件」做真实链路验证。

语法检查：

```powershell
node --check index.js
node --check client.js
node --check lib/store.js
node --check lib/smtp.js
```

### 目录结构

```
dsh-lockbox/
  package.json          # bundle manifest + dsh.client
  cordis.patch.yml      # 插入 dsh-lockbox
  index.js              # Host：门禁 + HTTP 路由
  client.js             # 浏览器：锁屏、设置页、左侧栏加密入口、CSS
  lib/store.js          # 凭据/会话/验证码状态机
  lib/smtp.js           # 零依赖 SMTP 客户端
  bin/reset.mjs         # 离线重置密码
  locale/{zh,en}.json   # 插件市场展示文案
  test/                 # node:test 测试
```

### HTTP 接口

所有接口前缀为 `/dsh-lockbox-7347`：

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/status` | 是否已配置、是否锁定、掩码邮箱、自动锁定时间 |
| POST | `/setup` | 首次初始化（密码、恢复邮箱、SMTP），成功即解锁 |
| POST | `/setup/test-smtp` | 初始化阶段测试 SMTP（仅未配置时） |
| POST | `/unlock` | 密码解锁，返回会话 token |
| POST | `/lock` | 立即锁定并清空所有会话 |
| POST | `/heartbeat` | 续期当前会话 |
| POST | `/forgot` | 向已绑定邮箱发送验证码 |
| POST | `/reset` | 验证码 + 新密码重置（保持锁定） |
| GET | `/settings` | 读取安全设置 |
| PUT | `/settings/password` | 修改密码（需当前密码，成功后锁定） |
| PUT | `/settings/email` | 修改恢复邮箱（需当前密码） |
| PUT | `/settings/smtp` | 修改 SMTP（需 token） |
| PUT | `/settings/auto-lock` | 修改自动锁定分钟数 |
| POST | `/settings/test-email` | 发送测试邮件（需 token） |

认证头支持 `Authorization: Bearer <token>` 或 `X-Lockbox-Token: <token>`。JSON body 上限 64 KB。

---

## 设计取舍

- **为什么不用 `@deepseek-ai/dsh-credentials`**：插件以目录联接方式安装，跨 checkout 的 `@deepseek-ai/*` 运行时解析不稳定；因此选择零依赖，把状态保存在 `$DSH_HOME/dsh-lockbox`。
- **为什么离线重置不要求旧密码**：邮箱找回是正常路径；离线脚本是本机应急路径。两者都需要某种「所有权证明」——邮箱控制权，或本机文件访问权。没有本机文件访问权的人无法运行它。
- **为什么每次启动都锁定**：解锁会话只在内存中，进程重启即失效；这样「重启 DSH」不会被当成绕过锁的方式。
- **为什么验证码固定发到配置邮箱**：避免攻击者通过接口向任意邮箱发信，也避免邮箱枚举。代价是改邮箱必须先进设置页（需要当前密码）。
- **为什么门禁放在 `connection/request`**：这是 `/api` 进入 bridge 前的最后一个统一瀑布；比在每个 RPC 方法里加检查更可靠，也不依赖前端。

---

## License

Private / local plugin. 随你的 DSH 配置自行使用。

