// dsh-lockbox — browser half.
//
// This file is a plain side-effect script: it must not use top-level ESM
// import/export. React and the jsx-runtime are provided by the DSH module
// loader inside the factory below.
window.__ModuleLoader__.load({
  id: 'dsh-lockbox',
  factory(require) {
    const React = require('react');
    const { useEffect, useMemo, useRef, useState } = React;
    const h = React.createElement;

    const NS = 'dsh-lockbox';
    const API_BASE = '/dsh-lockbox-7347';
    const TOKEN_KEY = 'dsh-lockbox.token';
    let t = (key) => key;
    let memoryToken = '';

    const zh = {
      'app.name': 'DSH 加密锁',
      'app.tagline': '启动时验证身份，离开时一键加密',
      'app.secure': '本地加密 · 零依赖',
      'common.cancel': '取消',
      'common.back': '返回',
      'common.retry': '重试',
      'common.save': '保存',
      'common.saving': '保存中…',
      'common.loading': '正在检查加密锁…',
      'common.showPassword': '显示密码',
      'common.hidePassword': '隐藏密码',
      'common.optional': '可选',
      'common.close': '关闭',
      'setup.title': '设置你的加密锁',
      'setup.subtitle': '首次使用需要设置启动密码和恢复邮箱。密码只保存在本机。',
      'setup.step1': '1 / 2 启动密码',
      'setup.step2': '2 / 2 邮件服务',
      'setup.password': '启动密码',
      'setup.passwordHint': '至少 8 位，建议混合大小写、数字和符号。',
      'setup.confirm': '确认密码',
      'setup.email': '恢复邮箱',
      'setup.emailHint': '忘记密码时，验证码会发送到这个邮箱。',
      'setup.next': '下一步',
      'setup.smtpTitle': '配置邮件发送',
      'setup.smtpSubtitle': '用于发送 6 位验证码。QQ / 163 邮箱请填写授权码，而不是登录密码。',
      'setup.preset': '邮箱服务商',
      'setup.preset.qq': 'QQ 邮箱',
      'setup.preset.163': '163 邮箱',
      'setup.preset.gmail': 'Gmail',
      'setup.preset.outlook': 'Outlook / Microsoft 365',
      'setup.preset.custom': '自定义 SMTP',
      'setup.host': 'SMTP 主机',
      'setup.port': '端口',
      'setup.security': '连接方式',
      'setup.security.ssl': 'SSL / TLS（通常 465）',
      'setup.security.starttls': 'STARTTLS（通常 587）',
      'setup.security.none': '明文（通常 25，不推荐）',
      'setup.user': 'SMTP 账号',
      'setup.smtpPassword': 'SMTP 授权码 / 密码',
      'setup.smtpPasswordHint': '留空表示稍后填写；QQ / 163 请使用授权码。',
      'setup.from': '发件人',
      'setup.fromHint': '留空则使用恢复邮箱。',
      'setup.test': '发送测试邮件',
      'setup.testing': '正在发送…',
      'setup.testOk': '测试邮件已发送，请查收（包括垃圾箱）。',
      'setup.finish': '完成并进入',
      'setup.finishing': '正在创建…',
      'setup.skipTest': '也可以不测试直接完成；如果邮件配置有误，忘记密码时将无法收信。',
      'setup.error.password': '密码至少需要 8 位。',
      'setup.error.confirm': '两次输入的密码不一致。',
      'setup.error.email': '请输入有效的恢复邮箱。',
      'setup.error.host': '请输入 SMTP 主机。',
      'setup.error.port': '端口需要在 1-65535 之间。',
      'setup.error.user': '请输入 SMTP 账号。',
      'setup.error.from': '发件人需要是有效邮箱地址。',
      'setup.testFailed': '测试邮件发送失败：{detail}',
      'login.title': '解锁 DSH',
      'login.subtitle': '输入启动密码以继续使用 DeepSeek Harness。',
      'login.password': '启动密码',
      'login.submit': '解锁',
      'login.unlocking': '正在验证…',
      'login.forgot': '忘记密码？',
      'login.recovery': '恢复邮箱：{email}',
      'login.attempts': '还可尝试 {n} 次',
      'login.lockedFor': '尝试过多，请 {s} 秒后再试',
      'login.sessionExpired': '会话已锁定，请重新输入密码。',
      'login.corruptTitle': '加密锁配置损坏',
      'login.corruptBody': '无法读取 config.json。请修复或删除 {dir}/config.json 后重启 DSH。',
      'login.keyError': 'secret.key 不可用，邮件找回功能可能失效。',
      'login.enter': '正在进入…',
      'forgot.title': '找回密码',
      'forgot.subtitle': '验证码会发送到已配置的恢复邮箱。',
      'forgot.send': '发送验证码',
      'forgot.sending': '正在发送…',
      'forgot.sent': '验证码已发送至 {email}。',
      'forgot.resend': '重新发送',
      'forgot.cooldown': '{s} 秒后可重新发送',
      'forgot.code': '6 位验证码',
      'forgot.newPassword': '新密码',
      'forgot.confirm': '确认新密码',
      'forgot.reset': '重置密码',
      'forgot.resetting': '正在重置…',
      'forgot.done': '密码已重置，请使用新密码登录。',
      'forgot.noSmtp': '尚未配置 SMTP，无法发送验证码。请在本机运行 bin/reset.mjs 离线重置。',
      'forgot.offline': '如果收不到邮件，可在本机终端运行 bin/reset.mjs 离线重置。',
      'settings.nav': '加密锁',
      'settings.title': '加密锁与安全',
      'settings.subtitle': '启动验证、邮箱找回与界面内一键加密。',
      'settings.status': '当前状态',
      'settings.enabled': '已启用',
      'settings.unlocked': '已解锁',
      'settings.locked': '已锁定',
      'settings.recovery': '恢复邮箱',
      'settings.autoLock': '自动锁定',
      'settings.autoLockValue': '{n} 分钟无操作',
      'settings.smtp': '邮件服务',
      'settings.smtpReady': '已配置 {host}',
      'settings.smtpMissing': '未配置',
      'settings.storage': '本机存储',
      'settings.storageHint': '密码哈希与加密后的 SMTP 授权码保存在 {dir}。',
      'settings.unlockTitle': '解锁以管理安全设置',
      'settings.unlockBody': '此页面需要启动密码。',
      'settings.unlock': '解锁',
      'settings.passwordTitle': '修改启动密码',
      'settings.passwordBody': '修改后所有会话会立即失效，需要重新登录。',
      'settings.current': '当前密码',
      'settings.new': '新密码',
      'settings.confirm': '确认新密码',
      'settings.change': '修改密码',
      'settings.changing': '正在修改…',
      'settings.passwordChanged': '密码已修改，请重新登录。',
      'settings.emailTitle': '恢复邮箱',
      'settings.emailBody': '修改后，新的验证码会发送到新邮箱。',
      'settings.emailNew': '新邮箱',
      'settings.emailSave': '保存邮箱',
      'settings.emailSaved': '恢复邮箱已更新。',
      'settings.smtpTitle': 'SMTP 邮件服务',
      'settings.smtpBody': '用于发送验证码和测试邮件。授权码留空表示不修改。',
      'settings.smtpPassword': '授权码 / 密码',
      'settings.smtpPasswordKeep': '留空保持不变',
      'settings.smtpClear': '清除已保存的授权码',
      'settings.smtpSave': '保存 SMTP',
      'settings.smtpSaved': 'SMTP 配置已保存。',
      'settings.test': '发送测试邮件',
      'settings.testing': '正在发送…',
      'settings.testOk': '测试邮件已发送至 {email}。',
      'settings.autoTitle': '自动锁定',
      'settings.autoBody': '空闲超过该时长后，界面会自动回到锁定状态。',
      'settings.autoSave': '保存自动锁定',
      'settings.autoSaved': '自动锁定时间已更新。',
      'settings.lockNow': '立即进入加密模式',
      'settings.lockNowBody': '锁定后整个界面会被锁屏覆盖，输入密码后才能继续使用。',
      'settings.lockConfirm': '再次点击确认锁定',
      'settings.lockedNow': '已锁定。',
      'settings.unauthorized': '会话已失效，请重新解锁。',
      'fab.label': '加密模式',
      'fab.tip': '一键锁定 DSH',
      'nav.lock': '加密模式',
      'nav.lockTip': '点击立即进入加密模式',
      'fab.confirmTitle': '进入加密模式？',
      'fab.confirmBody': '锁定后需要密码才能继续使用。',
      'fab.confirm': '立即锁定',
      'fab.locking': '正在锁定…',
      'err.network': '无法连接 DSH 服务，请确认应用仍在运行。',
      'err.timeout': '请求超时，请稍后重试。',
      'err.invalidPassword': '密码不正确。',
      'err.tooMany': '尝试次数过多，请稍后再试。',
      'err.cooldown': '操作太频繁，请稍后再试。',
      'err.emailFailed': '邮件发送失败：{detail}',
      'err.smtpNotConfigured': '尚未配置 SMTP。',
      'err.unauthorized': '会话已失效，请重新解锁。',
      'err.invalidCode': '验证码不正确。',
      'err.codeExpired': '验证码已过期，请重新发送。',
      'err.noCode': '请先发送验证码。',
      'err.invalidJson': '请求格式不正确。',
      'err.generic': '操作失败，请稍后重试。',
      'err.keyMissing': 'secret.key 缺失，无法解密 SMTP 授权码。',
      'err.configCorrupt': '加密锁配置损坏。',
      'strength.weak': '弱',
      'strength.fair': '一般',
      'strength.good': '良好',
      'strength.strong': '强',
    };

    const en = {
      'app.name': 'DSH Lockbox',
      'app.tagline': 'Verify at startup. Lock with one click.',
      'app.secure': 'Local encryption · Zero dependencies',
      'common.cancel': 'Cancel',
      'common.back': 'Back',
      'common.retry': 'Retry',
      'common.save': 'Save',
      'common.saving': 'Saving…',
      'common.loading': 'Checking the lockbox…',
      'common.showPassword': 'Show password',
      'common.hidePassword': 'Hide password',
      'common.optional': 'Optional',
      'common.close': 'Close',
      'setup.title': 'Set up your lockbox',
      'setup.subtitle': 'Choose a startup password and a recovery email. The password never leaves this machine.',
      'setup.step1': '1 / 2 Startup password',
      'setup.step2': '2 / 2 Mail service',
      'setup.password': 'Startup password',
      'setup.passwordHint': 'At least 8 characters. Mix case, digits, and symbols.',
      'setup.confirm': 'Confirm password',
      'setup.email': 'Recovery email',
      'setup.emailHint': 'Password-reset codes will be sent to this address.',
      'setup.next': 'Next',
      'setup.smtpTitle': 'Configure outgoing mail',
      'setup.smtpSubtitle': 'Used to deliver 6-digit codes. For QQ / 163 use an app password, not your login password.',
      'setup.preset': 'Mail provider',
      'setup.preset.qq': 'QQ Mail',
      'setup.preset.163': '163 Mail',
      'setup.preset.gmail': 'Gmail',
      'setup.preset.outlook': 'Outlook / Microsoft 365',
      'setup.preset.custom': 'Custom SMTP',
      'setup.host': 'SMTP host',
      'setup.port': 'Port',
      'setup.security': 'Security',
      'setup.security.ssl': 'SSL / TLS (usually 465)',
      'setup.security.starttls': 'STARTTLS (usually 587)',
      'setup.security.none': 'Plaintext (usually 25, not recommended)',
      'setup.user': 'SMTP username',
      'setup.smtpPassword': 'SMTP app password',
      'setup.smtpPasswordHint': 'Leave blank to fill later. QQ / 163 require an app password.',
      'setup.from': 'From address',
      'setup.fromHint': 'Defaults to the recovery email.',
      'setup.test': 'Send test email',
      'setup.testing': 'Sending…',
      'setup.testOk': 'Test email sent. Check your inbox and spam folder.',
      'setup.finish': 'Finish and enter',
      'setup.finishing': 'Creating…',
      'setup.skipTest': 'You can finish without testing, but a broken mail setup will break password recovery.',
      'setup.error.password': 'Use at least 8 characters.',
      'setup.error.confirm': 'The passwords do not match.',
      'setup.error.email': 'Enter a valid recovery email.',
      'setup.error.host': 'Enter the SMTP host.',
      'setup.error.port': 'The port must be between 1 and 65535.',
      'setup.error.user': 'Enter the SMTP username.',
      'setup.error.from': 'The From address must be a valid email.',
      'setup.testFailed': 'Test email failed: {detail}',
      'login.title': 'Unlock DSH',
      'login.subtitle': 'Enter your startup password to continue using DeepSeek Harness.',
      'login.password': 'Startup password',
      'login.submit': 'Unlock',
      'login.unlocking': 'Verifying…',
      'login.forgot': 'Forgot password?',
      'login.recovery': 'Recovery email: {email}',
      'login.attempts': '{n} attempts left',
      'login.lockedFor': 'Too many attempts. Try again in {s}s.',
      'login.sessionExpired': 'The session was locked. Enter your password again.',
      'login.corruptTitle': 'Lockbox configuration is damaged',
      'login.corruptBody': 'config.json cannot be read. Repair or remove {dir}/config.json, then restart DSH.',
      'login.keyError': 'secret.key is unavailable; email recovery may not work.',
      'login.enter': 'Entering…',
      'forgot.title': 'Recover password',
      'forgot.subtitle': 'A verification code will be sent to the configured recovery email.',
      'forgot.send': 'Send code',
      'forgot.sending': 'Sending…',
      'forgot.sent': 'Code sent to {email}.',
      'forgot.resend': 'Resend',
      'forgot.cooldown': 'Resend in {s}s',
      'forgot.code': '6-digit code',
      'forgot.newPassword': 'New password',
      'forgot.confirm': 'Confirm new password',
      'forgot.reset': 'Reset password',
      'forgot.resetting': 'Resetting…',
      'forgot.done': 'Password reset. Sign in with the new password.',
      'forgot.noSmtp': 'SMTP is not configured, so no code can be sent. Run bin/reset.mjs locally to reset offline.',
      'forgot.offline': 'If the email does not arrive, run bin/reset.mjs locally to reset offline.',
      'settings.nav': 'Lockbox',
      'settings.title': 'Lockbox & security',
      'settings.subtitle': 'Startup verification, email recovery, and one-click locking.',
      'settings.status': 'Current status',
      'settings.enabled': 'Enabled',
      'settings.unlocked': 'Unlocked',
      'settings.locked': 'Locked',
      'settings.recovery': 'Recovery email',
      'settings.autoLock': 'Auto-lock',
      'settings.autoLockValue': '{n} minutes idle',
      'settings.smtp': 'Mail service',
      'settings.smtpReady': 'Configured: {host}',
      'settings.smtpMissing': 'Not configured',
      'settings.storage': 'Local storage',
      'settings.storageHint': 'The password hash and encrypted SMTP secret live in {dir}.',
      'settings.unlockTitle': 'Unlock to manage security',
      'settings.unlockBody': 'This page requires the startup password.',
      'settings.unlock': 'Unlock',
      'settings.passwordTitle': 'Change startup password',
      'settings.passwordBody': 'All sessions are invalidated and you must sign in again.',
      'settings.current': 'Current password',
      'settings.new': 'New password',
      'settings.confirm': 'Confirm new password',
      'settings.change': 'Change password',
      'settings.changing': 'Changing…',
      'settings.passwordChanged': 'Password changed. Sign in again.',
      'settings.emailTitle': 'Recovery email',
      'settings.emailBody': 'Future codes will be sent to the new address.',
      'settings.emailNew': 'New email',
      'settings.emailSave': 'Save email',
      'settings.emailSaved': 'Recovery email updated.',
      'settings.smtpTitle': 'SMTP mail service',
      'settings.smtpBody': 'Used for verification and test emails. Leave the password blank to keep it.',
      'settings.smtpPassword': 'App password',
      'settings.smtpPasswordKeep': 'Leave blank to keep',
      'settings.smtpClear': 'Clear the saved app password',
      'settings.smtpSave': 'Save SMTP',
      'settings.smtpSaved': 'SMTP settings saved.',
      'settings.test': 'Send test email',
      'settings.testing': 'Sending…',
      'settings.testOk': 'Test email sent to {email}.',
      'settings.autoTitle': 'Auto-lock',
      'settings.autoBody': 'After this much idle time the UI returns to the lock screen.',
      'settings.autoSave': 'Save auto-lock',
      'settings.autoSaved': 'Auto-lock updated.',
      'settings.lockNow': 'Enter encryption mode now',
      'settings.lockNowBody': 'The whole app is covered by the lock screen until the password is entered again.',
      'settings.lockConfirm': 'Click again to confirm',
      'settings.lockedNow': 'Locked.',
      'settings.unauthorized': 'The session expired. Unlock again.',
      'fab.label': 'Encryption mode',
      'fab.tip': 'Lock DSH now',
      'nav.lock': 'Encryption mode',
      'nav.lockTip': 'Click to enter encryption mode now',
      'fab.confirmTitle': 'Enter encryption mode?',
      'fab.confirmBody': 'You will need the password to continue.',
      'fab.confirm': 'Lock now',
      'fab.locking': 'Locking…',
      'err.network': 'Cannot reach the DSH service. Is the app still running?',
      'err.timeout': 'The request timed out. Try again.',
      'err.invalidPassword': 'Incorrect password.',
      'err.tooMany': 'Too many attempts. Try again later.',
      'err.cooldown': 'Too many requests. Try again later.',
      'err.emailFailed': 'Email delivery failed: {detail}',
      'err.smtpNotConfigured': 'SMTP is not configured.',
      'err.unauthorized': 'The session expired. Unlock again.',
      'err.invalidCode': 'Incorrect verification code.',
      'err.codeExpired': 'The code expired. Request a new one.',
      'err.noCode': 'Request a verification code first.',
      'err.invalidJson': 'The request format is invalid.',
      'err.generic': 'The operation failed. Try again.',
      'err.keyMissing': 'secret.key is missing; the SMTP secret cannot be decrypted.',
      'err.configCorrupt': 'The lockbox configuration is damaged.',
      'strength.weak': 'Weak',
      'strength.fair': 'Fair',
      'strength.good': 'Good',
      'strength.strong': 'Strong',
    };

    function tf(key, vars) {
      let value = String(t(key));
      if (vars) {
        for (const name of Object.keys(vars)) {
          value = value.split('{' + name + '}').join(String(vars[name]));
        }
      }
      return value;
    }

    function readToken() {
      try {
        return sessionStorage.getItem(TOKEN_KEY) || memoryToken;
      } catch {
        return memoryToken;
      }
    }

    function writeToken(value) {
      memoryToken = value || '';
      try {
        if (value) sessionStorage.setItem(TOKEN_KEY, value);
        else sessionStorage.removeItem(TOKEN_KEY);
      } catch {
        // sessionStorage may be disabled; the in-memory token still works for
        // this page and is intentionally lost on reload.
      }
    }

    async function api(path, options = {}) {
      const method = options.method || 'GET';
      const timeoutMs = options.timeoutMs || 30000;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const headers = {};
        if (options.body !== undefined) headers['Content-Type'] = 'application/json';
        if (options.token) headers.Authorization = 'Bearer ' + options.token;
        const response = await fetch(API_BASE + path, {
          method,
          headers,
          body: options.body === undefined ? undefined : JSON.stringify(options.body),
          credentials: 'same-origin',
          signal: controller.signal,
        });
        let data = null;
        try {
          data = await response.json();
        } catch {
          data = null;
        }
        if (!response.ok) {
          const error = new Error((data && data.message) || 'HTTP ' + response.status);
          error.status = response.status;
          if (data) Object.assign(error, data);
          throw error;
        }
        return data || { ok: true };
      } catch (error) {
        if (error && error.name === 'AbortError') {
          const timeout = new Error(t('err.timeout'));
          timeout.code = 'TIMEOUT';
          throw timeout;
        }
        if (error instanceof TypeError) {
          const network = new Error(t('err.network'));
          network.code = 'NETWORK';
          throw network;
        }
        throw error;
      } finally {
        clearTimeout(timer);
      }
    }

    function reloadSoon(delay) {
      setTimeout(() => {
        try {
          window.location.reload();
        } catch {
          // In a non-browser test harness there is nothing to reload.
        }
      }, delay === undefined ? 120 : delay);
    }

    function errorText(error) {
      if (!error) return '';
      const code = error.code;
      if (code === 'INVALID_PASSWORD') return t('err.invalidPassword');
      if (code === 'TOO_MANY_ATTEMPTS') return t('err.tooMany');
      if (code === 'COOLDOWN' || code === 'TOO_MANY_REQUESTS') return t('err.cooldown');
      if (code === 'EMAIL_SEND_FAILED') {
        return tf('err.emailFailed', { detail: truncate(error.detail || error.message || '', 220) });
      }
      if (code === 'SMTP_NOT_CONFIGURED') return t('err.smtpNotConfigured');
      if (code === 'UNAUTHORIZED') return t('err.unauthorized');
      if (code === 'INVALID_CODE') return t('err.invalidCode');
      if (code === 'CODE_EXPIRED') return t('err.codeExpired');
      if (code === 'NO_CODE') return t('err.noCode');
      if (code === 'SECRET_KEY_MISSING') return t('err.keyMissing');
      if (code === 'CONFIG_CORRUPT') return t('err.configCorrupt');
      if (code === 'INVALID_JSON') return t('err.invalidJson');
      if (code === 'NETWORK' || code === 'TIMEOUT') return error.message;
      return error.message || t('err.generic');
    }

    function truncate(value, max) {
      const text = String(value);
      return text.length > max ? text.slice(0, max) + '…' : text;
    }

    function IconLock(props) {
      const size = props.size || 20;
      return h(
        'svg',
        { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': 'true' },
        h('rect', { x: 4, y: 10, width: 16, height: 10, rx: 2.5 }),
        h('path', { d: 'M8 10V7a4 4 0 0 1 8 0v3' }),
        h('circle', { cx: 12, cy: 15, r: 1 }),
      );
    }

    function IconShield(props) {
      const size = props.size || 20;
      return h(
        'svg',
        { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': 'true' },
        h('path', { d: 'M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3z' }),
        h('path', { d: 'M9 12l2 2 4-4' }),
      );
    }

    function IconMail(props) {
      const size = props.size || 18;
      return h(
        'svg',
        { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': 'true' },
        h('rect', { x: 3, y: 5, width: 18, height: 14, rx: 2 }),
        h('path', { d: 'M3 7l9 6 9-6' }),
      );
    }

    function IconKey(props) {
      const size = props.size || 18;
      return h(
        'svg',
        { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': 'true' },
        h('circle', { cx: 8, cy: 15, r: 4 }),
        h('path', { d: 'M11 12l8-8M17 4l3 3M15 6l3 3' }),
      );
    }

    function IconEye(props) {
      const size = props.size || 18;
      return h(
        'svg',
        { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': 'true' },
        h('path', { d: 'M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z' }),
        h('circle', { cx: 12, cy: 12, r: 2.5 }),
      );
    }

    function IconEyeOff(props) {
      const size = props.size || 18;
      return h(
        'svg',
        { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': 'true' },
        h('path', { d: 'M3 3l18 18' }),
        h('path', { d: 'M10.6 6.2A10.6 10.6 0 0 1 12 6c6.5 0 10 6 10 6a17 17 0 0 1-2.1 2.8M6.2 6.2A17 17 0 0 0 2 12s3.5 6 10 6a10.6 10.6 0 0 0 4.1-.8' }),
        h('path', { d: 'M9.9 9.9a3 3 0 0 0 4.2 4.2' }),
      );
    }

    function IconCheck(props) {
      const size = props.size || 16;
      return h(
        'svg',
        { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': 'true' },
        h('path', { d: 'M5 12l4 4L19 6' }),
      );
    }

    function IconAlert(props) {
      const size = props.size || 16;
      return h(
        'svg',
        { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': 'true' },
        h('path', { d: 'M12 3l9 17H3L12 3z' }),
        h('path', { d: 'M12 9v5' }),
        h('circle', { cx: 12, cy: 17, r: 0.8, fill: 'currentColor' }),
      );
    }

    function IconArrowLeft(props) {
      const size = props.size || 16;
      return h(
        'svg',
        { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': 'true' },
        h('path', { d: 'M19 12H5M11 18l-6-6 6-6' }),
      );
    }

    function IconRefresh(props) {
      const size = props.size || 16;
      return h(
        'svg',
        { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': 'true' },
        h('path', { d: 'M20 11a8 8 0 0 0-14-4L4 9M4 4v5h5M4 13a8 8 0 0 0 14 4l2-2M20 20v-5h-5' }),
      );
    }

    function IconX(props) {
      const size = props.size || 16;
      return h(
        'svg',
        { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', 'aria-hidden': 'true' },
        h('path', { d: 'M6 6l12 12M18 6L6 18' }),
      );
    }

    function Brand(props) {
      return h(
        'div',
        { className: 'dsh-lockbox-brand' + (props.compact ? ' dsh-lockbox-brand--compact' : '') },
        h('div', { className: 'dsh-lockbox-brand__mark' }, h(IconLock, { size: props.compact ? 18 : 22 })),
        h(
          'div',
          { className: 'dsh-lockbox-brand__text' },
          h('div', { className: 'dsh-lockbox-brand__name' }, t('app.name')),
          props.compact ? null : h('div', { className: 'dsh-lockbox-brand__tagline' }, t('app.tagline')),
        ),
      );
    }

    function Spinner(props) {
      return h('span', { className: 'dsh-lockbox-spinner' + (props.small ? ' dsh-lockbox-spinner--small' : ''), 'aria-hidden': 'true' });
    }

    function Button(props) {
      const variant = props.variant || 'secondary';
      const busy = Boolean(props.busy);
      const disabled = Boolean(props.disabled) || busy;
      const rest = Object.assign({}, props);
      delete rest.variant;
      delete rest.busy;
      delete rest.disabled;
      delete rest.children;
      delete rest.className;
      return h(
        'button',
        Object.assign({}, rest, {
          type: rest.type || 'button',
          className: ('dsh-lockbox-btn dsh-lockbox-btn--' + variant + (props.className ? ' ' + props.className : '')).trim(),
          disabled,
        }),
        busy ? h(Spinner, { small: true }) : null,
        props.children,
      );
    }

    function Field(props) {
      return h(
        'div',
        { className: 'dsh-lockbox-field' + (props.className ? ' ' + props.className : '') },
        h('label', { className: 'dsh-lockbox-field__label', htmlFor: props.htmlFor }, props.label, props.optional ? h('span', { className: 'dsh-lockbox-field__optional' }, t('common.optional')) : null),
        props.children,
        props.hint ? h('div', { className: 'dsh-lockbox-field__hint' }, props.hint) : null,
      );
    }

    function TextInput(props) {
      const rest = Object.assign({}, props);
      delete rest.className;
      return h('input', Object.assign({}, rest, { className: 'dsh-lockbox-input' + (props.className ? ' ' + props.className : '') }));
    }

    function PasswordInput(props) {
      const [visible, setVisible] = useState(false);
      const rest = Object.assign({}, props);
      delete rest.className;
      return h(
        'div',
        { className: 'dsh-lockbox-password' },
        h(
          'input',
          Object.assign({}, rest, {
            className: 'dsh-lockbox-input dsh-lockbox-input--password' + (props.className ? ' ' + props.className : ''),
            type: visible ? 'text' : 'password',
          }),
        ),
        h(
          'button',
          {
            type: 'button',
            className: 'dsh-lockbox-eye',
            onClick: () => setVisible((value) => !value),
            'aria-label': visible ? t('common.hidePassword') : t('common.showPassword'),
            tabIndex: -1,
          },
          visible ? h(IconEyeOff, { size: 17 }) : h(IconEye, { size: 17 }),
        ),
      );
    }

    function Alert(props) {
      const tone = props.tone || 'info';
      return h(
        'div',
        { className: 'dsh-lockbox-alert dsh-lockbox-alert--' + tone, role: tone === 'error' ? 'alert' : 'status' },
        h('span', { className: 'dsh-lockbox-alert__icon' }, tone === 'error' ? h(IconAlert, { size: 16 }) : tone === 'success' ? h(IconCheck, { size: 16 }) : h(IconShield, { size: 16 })),
        h('div', { className: 'dsh-lockbox-alert__body' }, props.children),
      );
    }

    function StrengthMeter(props) {
      const password = props.password || '';
      const score = useMemo(() => {
        let value = 0;
        if (password.length >= 8) value += 1;
        if (password.length >= 12) value += 1;
        if (/[a-z]/.test(password) && /[A-Z]/.test(password)) value += 1;
        if (/\d/.test(password)) value += 1;
        if (/[^A-Za-z0-9]/.test(password)) value += 1;
        return Math.min(4, Math.max(0, Math.ceil((value / 5) * 4)));
      }, [password]);
      const labels = ['strength.weak', 'strength.fair', 'strength.good', 'strength.strong'];
      if (!password) return null;
      return h(
        'div',
        { className: 'dsh-lockbox-strength' },
        h(
          'div',
          { className: 'dsh-lockbox-strength__bars' },
          [0, 1, 2, 3].map((index) => h('span', { key: index, className: 'dsh-lockbox-strength__bar' + (index < score ? ' is-on' : '') + (score >= 3 ? ' is-strong' : '') })),
        ),
        h('span', { className: 'dsh-lockbox-strength__label' }, t(labels[Math.max(0, score - 1)])),
      );
    }

    function SetupWizard(props) {
      const [step, setStep] = useState(1);
      const [password, setPassword] = useState('');
      const [confirm, setConfirm] = useState('');
      const [email, setEmail] = useState('');
      const [smtp, setSmtp] = useState({
        preset: 'qq',
        host: 'smtp.qq.com',
        port: 465,
        security: 'ssl',
        user: '',
        password: '',
        from: '',
      });
      const [busy, setBusy] = useState(false);
      const [testBusy, setTestBusy] = useState(false);
      const [error, setError] = useState('');
      const [testMessage, setTestMessage] = useState('');
      const [testTone, setTestTone] = useState('success');

      function updateSmtp(patch) {
        setSmtp((current) => Object.assign({}, current, patch));
        setTestMessage('');
      }

      function choosePreset(key) {
        const presets = {
          qq: { host: 'smtp.qq.com', port: 465, security: 'ssl' },
          163: { host: 'smtp.163.com', port: 465, security: 'ssl' },
          gmail: { host: 'smtp.gmail.com', port: 587, security: 'starttls' },
          outlook: { host: 'smtp.office365.com', port: 587, security: 'starttls' },
          custom: {},
        };
        const preset = presets[key] || {};
        setSmtp((current) => Object.assign({}, current, preset, { preset: key }));
        setTestMessage('');
      }

      function validateStepOne() {
        if (password.length < 8) return t('setup.error.password');
        if (password !== confirm) return t('setup.error.confirm');
        if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email.trim())) return t('setup.error.email');
        return '';
      }

      function resolvedSmtp() {
        return {
          host: smtp.host.trim(),
          port: Number(smtp.port),
          security: smtp.security,
          user: smtp.user.trim() || email.trim(),
          password: smtp.password,
          from: smtp.from.trim() || email.trim(),
        };
      }

      function validateSmtp() {
        if (!smtp.host.trim()) return t('setup.error.host');
        const port = Number(smtp.port);
        if (!Number.isInteger(port) || port < 1 || port > 65535) return t('setup.error.port');
        if (!(smtp.user.trim() || email.trim())) return t('setup.error.user');
        if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test((smtp.from.trim() || email.trim()))) return t('setup.error.from');
        return '';
      }

      function goNext(event) {
        event.preventDefault();
        const message = validateStepOne();
        if (message) {
          setError(message);
          return;
        }
        setError('');
        setStep(2);
      }

      async function sendTest() {
        const message = validateSmtp();
        if (message) {
          setError(message);
          return;
        }
        setError('');
        setTestBusy(true);
        setTestMessage('');
        try {
          await api('/setup/test-smtp', {
            method: 'POST',
            body: { email: email.trim(), smtp: resolvedSmtp() },
            timeoutMs: 40000,
          });
          setTestTone('success');
          setTestMessage(t('setup.testOk'));
        } catch (failure) {
          setTestTone('error');
          setTestMessage(tf('setup.testFailed', { detail: truncate(failure.detail || failure.message || '', 220) }));
        } finally {
          setTestBusy(false);
        }
      }

      async function finish(event) {
        event.preventDefault();
        const stepOneError = validateStepOne();
        if (stepOneError) {
          setError(stepOneError);
          setStep(1);
          return;
        }
        const smtpError = validateSmtp();
        if (smtpError) {
          setError(smtpError);
          return;
        }
        setError('');
        setBusy(true);
        try {
          const data = await api('/setup', {
            method: 'POST',
            body: { password, email: email.trim(), smtp: resolvedSmtp() },
            timeoutMs: 30000,
          });
          props.onDone(data.token);
        } catch (failure) {
          setError(errorText(failure));
        } finally {
          setBusy(false);
        }
      }

      return h(
        'div',
        { className: 'dsh-lockbox-card dsh-lockbox-card--wide' },
        h(Brand, {}),
        h('div', { className: 'dsh-lockbox-heading' }, h('h1', { className: 'dsh-lockbox-title' }, t('setup.title')), h('p', { className: 'dsh-lockbox-subtitle' }, t('setup.subtitle'))),
        h(
          'div',
          { className: 'dsh-lockbox-steps' },
          h('div', { className: 'dsh-lockbox-step' + (step === 1 ? ' is-active' : ' is-done') }, h('span', { className: 'dsh-lockbox-step__dot' }, step === 1 ? '1' : h(IconCheck, { size: 12 })), h('span', {}, t('setup.step1'))),
          h('div', { className: 'dsh-lockbox-step__line' }),
          h('div', { className: 'dsh-lockbox-step' + (step === 2 ? ' is-active' : '') }, h('span', { className: 'dsh-lockbox-step__dot' }, '2'), h('span', {}, t('setup.step2'))),
        ),
        error ? h(Alert, { tone: 'error' }, error) : null,
        step === 1
          ? h(
              'form',
              { className: 'dsh-lockbox-form', onSubmit: goNext },
              h(
                Field,
                { label: t('setup.password'), htmlFor: 'dsh-lockbox-setup-password', hint: t('setup.passwordHint') },
                h(PasswordInput, {
                  id: 'dsh-lockbox-setup-password',
                  value: password,
                  onChange: (event) => setPassword(event.target.value),
                  autoFocus: true,
                  autoComplete: 'new-password',
                }),
                h(StrengthMeter, { password }),
              ),
              h(
                Field,
                { label: t('setup.confirm'), htmlFor: 'dsh-lockbox-setup-confirm' },
                h(PasswordInput, {
                  id: 'dsh-lockbox-setup-confirm',
                  value: confirm,
                  onChange: (event) => setConfirm(event.target.value),
                  autoComplete: 'new-password',
                }),
              ),
              h(
                Field,
                { label: t('setup.email'), htmlFor: 'dsh-lockbox-setup-email', hint: t('setup.emailHint') },
                h(TextInput, {
                  id: 'dsh-lockbox-setup-email',
                  type: 'email',
                  value: email,
                  onChange: (event) => setEmail(event.target.value),
                  placeholder: 'you@example.com',
                  autoComplete: 'email',
                }),
              ),
              h(
                'div',
                { className: 'dsh-lockbox-actions' },
                h('span', { className: 'dsh-lockbox-secure' }, h(IconShield, { size: 14 }), t('app.secure')),
                h(Button, { type: 'submit', variant: 'primary' }, t('setup.next')),
              ),
            )
          : h(
              'form',
              { className: 'dsh-lockbox-form', onSubmit: finish },
              h('p', { className: 'dsh-lockbox-section-note' }, t('setup.smtpSubtitle')),
              h(
                Field,
                { label: t('setup.preset'), htmlFor: 'dsh-lockbox-smtp-preset' },
                h(
                  'select',
                  {
                    id: 'dsh-lockbox-smtp-preset',
                    className: 'dsh-lockbox-input',
                    value: smtp.preset,
                    onChange: (event) => choosePreset(event.target.value),
                  },
                  h('option', { value: 'qq' }, t('setup.preset.qq')),
                  h('option', { value: '163' }, t('setup.preset.163')),
                  h('option', { value: 'gmail' }, t('setup.preset.gmail')),
                  h('option', { value: 'outlook' }, t('setup.preset.outlook')),
                  h('option', { value: 'custom' }, t('setup.preset.custom')),
                ),
              ),
              h(
                'div',
                { className: 'dsh-lockbox-grid2' },
                h(
                  Field,
                  { label: t('setup.host'), htmlFor: 'dsh-lockbox-smtp-host' },
                  h(TextInput, { id: 'dsh-lockbox-smtp-host', value: smtp.host, onChange: (event) => updateSmtp({ host: event.target.value }), placeholder: 'smtp.example.com', autoComplete: 'off' }),
                ),
                h(
                  Field,
                  { label: t('setup.port'), htmlFor: 'dsh-lockbox-smtp-port' },
                  h(TextInput, { id: 'dsh-lockbox-smtp-port', type: 'number', min: 1, max: 65535, value: smtp.port, onChange: (event) => updateSmtp({ port: event.target.value }), autoComplete: 'off' }),
                ),
              ),
              h(
                Field,
                { label: t('setup.security'), htmlFor: 'dsh-lockbox-smtp-security' },
                h(
                  'select',
                  {
                    id: 'dsh-lockbox-smtp-security',
                    className: 'dsh-lockbox-input',
                    value: smtp.security,
                    onChange: (event) => updateSmtp({ security: event.target.value }),
                  },
                  h('option', { value: 'ssl' }, t('setup.security.ssl')),
                  h('option', { value: 'starttls' }, t('setup.security.starttls')),
                  h('option', { value: 'none' }, t('setup.security.none')),
                ),
              ),
              h(
                'div',
                { className: 'dsh-lockbox-grid2' },
                h(
                  Field,
                  { label: t('setup.user'), htmlFor: 'dsh-lockbox-smtp-user' },
                  h(TextInput, { id: 'dsh-lockbox-smtp-user', value: smtp.user, onChange: (event) => updateSmtp({ user: event.target.value }), placeholder: email || 'you@example.com', autoComplete: 'username' }),
                ),
                h(
                  Field,
                  { label: t('setup.smtpPassword'), htmlFor: 'dsh-lockbox-smtp-password', optional: true },
                  h(PasswordInput, { id: 'dsh-lockbox-smtp-password', value: smtp.password, onChange: (event) => updateSmtp({ password: event.target.value }), autoComplete: 'new-password' }),
                ),
              ),
              h('div', { className: 'dsh-lockbox-field__hint dsh-lockbox-field__hint--standalone' }, t('setup.smtpPasswordHint')),
              h(
                Field,
                { label: t('setup.from'), htmlFor: 'dsh-lockbox-smtp-from', optional: true, hint: t('setup.fromHint') },
                h(TextInput, { id: 'dsh-lockbox-smtp-from', value: smtp.from, onChange: (event) => updateSmtp({ from: event.target.value }), placeholder: email || 'you@example.com', autoComplete: 'email' }),
              ),
              testMessage ? h(Alert, { tone: testTone }, testMessage) : null,
              h('p', { className: 'dsh-lockbox-section-note' }, t('setup.skipTest')),
              h(
                'div',
                { className: 'dsh-lockbox-actions dsh-lockbox-actions--split' },
                h(Button, { variant: 'ghost', onClick: () => setStep(1), disabled: busy || testBusy }, h(IconArrowLeft, { size: 15 }), t('common.back')),
                h(
                  'div',
                  { className: 'dsh-lockbox-actions__right' },
                  h(Button, { variant: 'secondary', onClick: sendTest, busy: testBusy }, testBusy ? t('setup.testing') : t('setup.test')),
                  h(Button, { type: 'submit', variant: 'primary', busy }, busy ? t('setup.finishing') : t('setup.finish')),
                ),
              ),
            ),
      );
    }

    function Login(props) {
      const [password, setPassword] = useState('');
      const retryLeft = props.retryLeft || 0;
      const error = props.error;
      function submit(event) {
        event.preventDefault();
        if (!password || props.busy || retryLeft > 0) return;
        props.onUnlock(password);
      }
      return h(
        'div',
        { className: 'dsh-lockbox-card' },
        h(Brand, {}),
        h(
          'div',
          { className: 'dsh-lockbox-heading' },
          h('h1', { className: 'dsh-lockbox-title' }, t('login.title')),
          h('p', { className: 'dsh-lockbox-subtitle' }, t('login.subtitle')),
        ),
        props.notice ? h(Alert, { tone: 'success' }, props.notice) : null,
        error ? h(Alert, { tone: 'error' }, errorText(error), error.remaining ? h('span', { className: 'dsh-lockbox-alert__meta' }, tf('login.attempts', { n: error.remaining })) : null) : null,
        retryLeft > 0 ? h(Alert, { tone: 'warning' }, tf('login.lockedFor', { s: retryLeft })) : null,
        props.status && props.status.keyError ? h(Alert, { tone: 'warning' }, t('login.keyError')) : null,
        h(
          'form',
          { className: 'dsh-lockbox-form', onSubmit: submit },
          h(
            Field,
            { label: t('login.password'), htmlFor: 'dsh-lockbox-login-password' },
            h(PasswordInput, {
              id: 'dsh-lockbox-login-password',
              value: password,
              onChange: (event) => setPassword(event.target.value),
              autoFocus: true,
              autoComplete: 'current-password',
              disabled: props.busy,
            }),
          ),
          h(Button, { type: 'submit', variant: 'primary', busy: props.busy, disabled: !password || retryLeft > 0 }, props.busy ? t('login.unlocking') : t('login.submit')),
        ),
        h(
          'div',
          { className: 'dsh-lockbox-login-footer' },
          h('button', { type: 'button', className: 'dsh-lockbox-link', onClick: props.onForgot }, t('login.forgot')),
          props.status && props.status.emailMasked ? h('span', { className: 'dsh-lockbox-muted' }, tf('login.recovery', { email: props.status.emailMasked })) : null,
        ),
      );
    }

    function Forgot(props) {
      const [sent, setSent] = useState(false);
      const [cooldown, setCooldown] = useState(0);
      const [code, setCode] = useState('');
      const [password, setPassword] = useState('');
      const [confirm, setConfirm] = useState('');
      const [busy, setBusy] = useState(false);
      const [error, setError] = useState(null);
      const [notice, setNotice] = useState('');

      useEffect(() => {
        if (cooldown <= 0) return undefined;
        const timer = setInterval(() => setCooldown((value) => Math.max(0, value - 1)), 1000);
        return () => clearInterval(timer);
      }, [cooldown]);

      async function sendCode() {
        if (busy || cooldown > 0) return;
        setBusy(true);
        setError(null);
        setNotice('');
        try {
          const data = await api('/forgot', { method: 'POST', timeoutMs: 40000 });
          setSent(true);
          setCooldown(60);
          setNotice(tf('forgot.sent', { email: data.emailMasked || (props.status && props.status.emailMasked) || '' }));
        } catch (failure) {
          setError(failure);
        } finally {
          setBusy(false);
        }
      }

      async function reset(event) {
        event.preventDefault();
        if (busy) return;
        if (!/^\d{6}$/.test(code.trim())) {
          setError({ code: 'INVALID_CODE', message: t('err.invalidCode') });
          return;
        }
        if (password.length < 8) {
          setError({ message: t('setup.error.password') });
          return;
        }
        if (password !== confirm) {
          setError({ message: t('setup.error.confirm') });
          return;
        }
        setBusy(true);
        setError(null);
        try {
          await api('/reset', { method: 'POST', body: { code: code.trim(), newPassword: password } });
          props.onDone();
        } catch (failure) {
          setError(failure);
        } finally {
          setBusy(false);
        }
      }

      const smtpReady = !props.status || props.status.smtpConfigured;
      return h(
        'div',
        { className: 'dsh-lockbox-card' },
        h(Brand, {}),
        h(
          'div',
          { className: 'dsh-lockbox-heading' },
          h('h1', { className: 'dsh-lockbox-title' }, t('forgot.title')),
          h('p', { className: 'dsh-lockbox-subtitle' }, t('forgot.subtitle')),
        ),
        props.status && props.status.emailMasked ? h('div', { className: 'dsh-lockbox-recovery' }, h(IconMail, { size: 16 }), h('span', {}, tf('login.recovery', { email: props.status.emailMasked }))) : null,
        smtpReady ? null : h(Alert, { tone: 'warning' }, t('forgot.noSmtp')),
        error ? h(Alert, { tone: 'error' }, errorText(error), error.remaining ? h('span', { className: 'dsh-lockbox-alert__meta' }, tf('login.attempts', { n: error.remaining })) : null) : null,
        notice ? h(Alert, { tone: 'success' }, notice) : null,
        h(
          'form',
          { className: 'dsh-lockbox-form', onSubmit: sent ? reset : (event) => { event.preventDefault(); sendCode(); } },
          sent
            ? h(
                'div',
                { className: 'dsh-lockbox-form' },
                h(
                  Field,
                  { label: t('forgot.code'), htmlFor: 'dsh-lockbox-reset-code' },
                  h(TextInput, {
                    id: 'dsh-lockbox-reset-code',
                    value: code,
                    onChange: (event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6)),
                    inputMode: 'numeric',
                    autoComplete: 'one-time-code',
                    placeholder: '000000',
                    autoFocus: true,
                    maxLength: 6,
                  }),
                ),
                h(
                  Field,
                  { label: t('forgot.newPassword'), htmlFor: 'dsh-lockbox-reset-password' },
                  h(PasswordInput, { id: 'dsh-lockbox-reset-password', value: password, onChange: (event) => setPassword(event.target.value), autoComplete: 'new-password' }),
                  h(StrengthMeter, { password }),
                ),
                h(
                  Field,
                  { label: t('forgot.confirm'), htmlFor: 'dsh-lockbox-reset-confirm' },
                  h(PasswordInput, { id: 'dsh-lockbox-reset-confirm', value: confirm, onChange: (event) => setConfirm(event.target.value), autoComplete: 'new-password' }),
                ),
                h(Button, { type: 'submit', variant: 'primary', busy, disabled: !smtpReady }, busy ? t('forgot.resetting') : t('forgot.reset')),
                h(
                  'div',
                  { className: 'dsh-lockbox-inline-actions' },
                  h(Button, { variant: 'ghost', onClick: sendCode, disabled: busy || cooldown > 0 || !smtpReady }, cooldown > 0 ? tf('forgot.cooldown', { s: cooldown }) : t('forgot.resend')),
                ),
              )
            : h(
                'div',
                { className: 'dsh-lockbox-form' },
                h(Button, { type: 'submit', variant: 'primary', busy, disabled: !smtpReady }, busy ? t('forgot.sending') : t('forgot.send')),
                h('p', { className: 'dsh-lockbox-section-note' }, t('forgot.offline')),
              ),
        ),
        h(
          'div',
          { className: 'dsh-lockbox-login-footer' },
          h('button', { type: 'button', className: 'dsh-lockbox-link', onClick: props.onBack }, h(IconArrowLeft, { size: 14 }), t('common.back')),
        ),
      );
    }

    function LoadingCard() {
      return h(
        'div',
        { className: 'dsh-lockbox-card dsh-lockbox-card--center' },
        h(Brand, {}),
        h('div', { className: 'dsh-lockbox-loading' }, h(Spinner, {}), h('span', {}, t('common.loading'))),
      );
    }

    function CorruptCard(props) {
      const dir = (props.status && props.status.configDir) || '$DSH_HOME/dsh-lockbox';
      return h(
        'div',
        { className: 'dsh-lockbox-card' },
        h(Brand, {}),
        h(
          'div',
          { className: 'dsh-lockbox-heading' },
          h('h1', { className: 'dsh-lockbox-title' }, t('login.corruptTitle')),
          h('p', { className: 'dsh-lockbox-subtitle' }, tf('login.corruptBody', { dir })),
        ),
        h(Alert, { tone: 'error' }, t('err.configCorrupt')),
        h(
          'div',
          { className: 'dsh-lockbox-actions' },
          h('code', { className: 'dsh-lockbox-path' }, dir + '/config.json'),
          h(Button, { variant: 'secondary', onClick: props.onRetry }, h(IconRefresh, { size: 15 }), t('common.retry')),
        ),
      );
    }

    function LockboxOverlay() {
      const [mode, setMode] = useState('loading');
      const [status, setStatus] = useState(null);
      const [token, setToken] = useState(readToken());
      const [error, setError] = useState(null);
      const [notice, setNotice] = useState('');
      const [busy, setBusy] = useState(false);
      const [retryAt, setRetryAt] = useState(0);
      const [clock, setClock] = useState(Date.now());
      const mounted = useRef(true);

      useEffect(() => {
        mounted.current = true;
        return () => {
          mounted.current = false;
        };
      }, []);

      useEffect(() => {
        if (!retryAt) return undefined;
        const timer = setInterval(() => setClock(Date.now()), 500);
        return () => clearInterval(timer);
      }, [retryAt]);

      async function boot() {
        setError(null);
        try {
          const nextStatus = await api('/status', { timeoutMs: 15000 });
          if (!mounted.current) return;
          setStatus(nextStatus);
          if (nextStatus.corrupt) {
            setMode('corrupt');
            return;
          }
          if (!nextStatus.configured) {
            setMode('setup');
            return;
          }
          const saved = readToken();
          if (saved) {
            try {
              await api('/heartbeat', { method: 'POST', token: saved, timeoutMs: 15000 });
              if (!mounted.current) return;
              setToken(saved);
              setMode('unlocked');
              return;
            } catch (failure) {
              if (failure.status === 401) {
                writeToken('');
                setToken('');
              } else {
                setError(failure);
              }
            }
          }
          setMode('login');
        } catch (failure) {
          if (!mounted.current) return;
          setError(failure);
          setMode('login');
        }
      }

      useEffect(() => {
        boot();
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, []);

      useEffect(() => {
        if (mode !== 'unlocked') return undefined;
        const timer = setInterval(async () => {
          try {
            await api('/heartbeat', { method: 'POST', token, timeoutMs: 15000 });
          } catch (failure) {
            if (failure.status === 401 && mounted.current) {
              writeToken('');
              setToken('');
              setError({ code: 'UNAUTHORIZED', message: t('login.sessionExpired') });
              setMode('login');
            }
          }
        }, 45000);
        return () => clearInterval(timer);
      }, [mode, token]);

      async function unlock(password) {
        setBusy(true);
        setError(null);
        setNotice('');
        try {
          const data = await api('/unlock', { method: 'POST', body: { password }, timeoutMs: 30000 });
          writeToken(data.token);
          setToken(data.token);
          setStatus(data.status || status);
          setMode('unlocked');
          reloadSoon();
        } catch (failure) {
          setError(failure);
          if (failure.retryAfterMs) {
            setRetryAt(Date.now() + failure.retryAfterMs);
            setClock(Date.now());
          }
        } finally {
          if (mounted.current) setBusy(false);
        }
      }

      function setupDone(newToken) {
        writeToken(newToken);
        setToken(newToken);
        setMode('unlocked');
        reloadSoon();
      }

      function resetDone() {
        writeToken('');
        setToken('');
        setError(null);
        setNotice(t('forgot.done'));
        setMode('login');
      }

      if (mode === 'unlocked') {
        return null;
      }

      const retryLeft = retryAt ? Math.max(0, Math.ceil((retryAt - clock) / 1000)) : 0;

      return h(
        'div',
        { className: 'dsh-lockbox-overlay', role: 'dialog', 'aria-modal': 'true', 'aria-label': t('app.name') },
        h('div', { className: 'dsh-lockbox-glow dsh-lockbox-glow--one' }),
        h('div', { className: 'dsh-lockbox-glow dsh-lockbox-glow--two' }),
        mode === 'loading' ? h(LoadingCard, {}) : null,
        mode === 'setup' ? h(SetupWizard, { status, onDone: setupDone }) : null,
        mode === 'login'
          ? h(Login, {
              status,
              busy,
              error: error && error.code !== 'UNAUTHORIZED' ? error : error,
              notice,
              retryLeft,
              onUnlock: unlock,
              onForgot: () => {
                setError(null);
                setNotice('');
                setMode('forgot');
              },
            })
          : null,
        mode === 'forgot' ? h(Forgot, { status, onBack: () => { setError(null); setNotice(''); setMode('login'); }, onDone: resetDone }) : null,
        mode === 'corrupt' ? h(CorruptCard, { status, onRetry: boot }) : null,
      );
    }

    // 左下角栏（sidebar.footer.action）的「加密模式」入口：点一下立即上锁。
    function SidebarLockAction(props) {
      const { t } = props;
      const wide = Boolean(props && props.wide);
      const [busy, setBusy] = useState(false);
      const [error, setError] = useState(null);

      async function lock(event) {
        if (event) event.preventDefault();
        if (busy) return;
        setBusy(true);
        setError(null);
        const token = readToken();
        try {
          await api('/lock', { method: 'POST', token, timeoutMs: 15000 });
          writeToken('');
          reloadSoon(80);
        } catch (failure) {
          setBusy(false);
          if (failure && (failure.code === 'UNAUTHORIZED' || failure.status === 401)) {
            // 会话已经失效，重新加载后同样会停在锁屏。
            writeToken('');
            reloadSoon(80);
            return;
          }
          setError(failure);
          const text = errorText(failure);
          try {
            window.alert(text);
          } catch {
            // 非浏览器环境没有 alert；错误仍保留在 title 上。
          }
        }
      }

      const title = error ? errorText(error) : t('nav.lockTip');
      return h(
        'button',
        {
          type: 'button',
          className: wide ? 'dsh-lockbox-nav dsh-lockbox-nav--wide' : 'dsh-lockbox-nav',
          onClick: lock,
          disabled: busy,
          title,
          'aria-label': t('nav.lock'),
        },
        busy ? h(Spinner, { small: true }) : h(IconLock, { size: 16 }),
        wide ? h('span', { className: 'dsh-lockbox-nav-label' }, t('nav.lock')) : null,
      );
    }

    function SettingsSection() {
      const [token, setToken] = useState(readToken());
      const [status, setStatus] = useState(null);
      const [settings, setSettings] = useState(null);
      const [loading, setLoading] = useState(Boolean(readToken()));
      const [error, setError] = useState(null);
      const [notice, setNotice] = useState('');
      const [noticeTone, setNoticeTone] = useState('success');
      const [unlockPassword, setUnlockPassword] = useState('');
      const [unlocking, setUnlocking] = useState(false);
      const [busy, setBusy] = useState('');
      const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
      const [emailForm, setEmailForm] = useState({ current: '', email: '' });
      const [smtp, setSmtp] = useState({ host: '', port: 465, security: 'ssl', user: '', from: '', password: '', clear: false });
      const [smtpLoaded, setSmtpLoaded] = useState(false);
      const [autoLock, setAutoLock] = useState('');
      const [lockArmed, setLockArmed] = useState(false);
      const mounted = useRef(true);

      useEffect(() => {
        mounted.current = true;
        return () => {
          mounted.current = false;
        };
      }, []);

      useEffect(() => {
        load(token);
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [token]);

      useEffect(() => {
        if (!settings || smtpLoaded) return;
        const current = settings.smtp || {};
        setSmtp({
          host: current.host || '',
          port: current.port || 465,
          security: current.security || 'ssl',
          user: current.user || '',
          from: current.from || '',
          password: '',
          clear: false,
        });
        setSmtpLoaded(true);
      }, [settings, smtpLoaded]);

      useEffect(() => {
        if (settings && autoLock === '') setAutoLock(String(settings.autoLockMinutes));
      }, [settings, autoLock]);

      useEffect(() => {
        if (!lockArmed) return undefined;
        const timer = setTimeout(() => setLockArmed(false), 5000);
        return () => clearTimeout(timer);
      }, [lockArmed]);

      function clearSession(message) {
        writeToken('');
        setToken('');
        setSettings(null);
        setStatus(null);
        setError(null);
        setNotice(message || '');
        setNoticeTone('warning');
      }

      function handleFailure(failure) {
        if (failure && failure.status === 401) {
          clearSession(t('settings.unauthorized'));
          return true;
        }
        setError(failure);
        return false;
      }

      function applySettings(next) {
        if (!next) return;
        setSettings(next);
        setStatus((current) =>
          current
            ? Object.assign({}, current, {
                emailMasked: next.emailMasked,
                configDir: next.configDir,
                locked: false,
              })
            : current,
        );
      }

      async function load(authToken) {
        if (!authToken) {
          setLoading(false);
          return;
        }
        setLoading(true);
        setError(null);
        try {
          const results = await Promise.all([
            api('/status', { token: authToken, timeoutMs: 15000 }),
            api('/settings', { token: authToken, timeoutMs: 15000 }),
          ]);
          if (!mounted.current) return;
          setStatus(results[0]);
          setSettings(results[1].settings || null);
        } catch (failure) {
          if (!mounted.current) return;
          if (failure.status === 401) clearSession(t('settings.unauthorized'));
          else setError(failure);
        } finally {
          if (mounted.current) setLoading(false);
        }
      }

      async function handleUnlock(event) {
        event.preventDefault();
        if (!unlockPassword || unlocking) return;
        setUnlocking(true);
        setError(null);
        setNotice('');
        try {
          const data = await api('/unlock', { method: 'POST', body: { password: unlockPassword }, timeoutMs: 30000 });
          writeToken(data.token);
          setUnlockPassword('');
          setToken(data.token);
        } catch (failure) {
          setError(failure);
        } finally {
          if (mounted.current) setUnlocking(false);
        }
      }

      async function savePassword(event) {
        event.preventDefault();
        if (busy) return;
        if (pw.next.length < 8) {
          setError({ message: t('setup.error.password') });
          return;
        }
        if (pw.next !== pw.confirm) {
          setError({ message: t('setup.error.confirm') });
          return;
        }
        setBusy('password');
        setError(null);
        setNotice('');
        try {
          await api('/settings/password', {
            method: 'PUT',
            token,
            body: { currentPassword: pw.current, newPassword: pw.next },
            timeoutMs: 30000,
          });
          setPw({ current: '', next: '', confirm: '' });
          setNoticeTone('success');
          setNotice(t('settings.passwordChanged'));
          writeToken('');
          setToken('');
          reloadSoon(1400);
        } catch (failure) {
          handleFailure(failure);
        } finally {
          if (mounted.current) setBusy('');
        }
      }

      async function saveEmail(event) {
        event.preventDefault();
        if (busy) return;
        if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(emailForm.email.trim())) {
          setError({ message: t('setup.error.email') });
          return;
        }
        setBusy('email');
        setError(null);
        setNotice('');
        try {
          const data = await api('/settings/email', {
            method: 'PUT',
            token,
            body: { currentPassword: emailForm.current, email: emailForm.email.trim() },
            timeoutMs: 30000,
          });
          applySettings(data.settings);
          setEmailForm({ current: '', email: '' });
          setNoticeTone('success');
          setNotice(t('settings.emailSaved'));
        } catch (failure) {
          handleFailure(failure);
        } finally {
          if (mounted.current) setBusy('');
        }
      }

      async function saveSmtp(event) {
        event.preventDefault();
        if (busy) return;
        const host = smtp.host.trim();
        const port = Number(smtp.port);
        const user = smtp.user.trim() || (settings ? settings.email : '');
        const from = smtp.from.trim() || (settings ? settings.email : '');
        if (!host) {
          setError({ message: t('setup.error.host') });
          return;
        }
        if (!Number.isInteger(port) || port < 1 || port > 65535) {
          setError({ message: t('setup.error.port') });
          return;
        }
        if (!user) {
          setError({ message: t('setup.error.user') });
          return;
        }
        if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(from)) {
          setError({ message: t('setup.error.from') });
          return;
        }
        setBusy('smtp');
        setError(null);
        setNotice('');
        try {
          const payload = { host, port, security: smtp.security, user, from };
          if (smtp.password) payload.password = smtp.password;
          const data = await api('/settings/smtp', {
            method: 'PUT',
            token,
            body: { smtp: payload, clearPassword: smtp.clear === true },
            timeoutMs: 30000,
          });
          applySettings(data.settings);
          setSmtp((current) => Object.assign({}, current, { password: '', clear: false }));
          setNoticeTone('success');
          setNotice(t('settings.smtpSaved'));
        } catch (failure) {
          handleFailure(failure);
        } finally {
          if (mounted.current) setBusy('');
        }
      }

      async function sendTestEmail() {
        if (busy) return;
        setBusy('test');
        setError(null);
        setNotice('');
        try {
          const data = await api('/settings/test-email', { method: 'POST', token, timeoutMs: 40000 });
          setNoticeTone('success');
          setNotice(tf('settings.testOk', { email: data.emailMasked || settings.emailMasked || '' }));
        } catch (failure) {
          handleFailure(failure);
        } finally {
          if (mounted.current) setBusy('');
        }
      }

      async function saveAutoLock(event) {
        event.preventDefault();
        if (busy) return;
        setBusy('auto');
        setError(null);
        setNotice('');
        try {
          const data = await api('/settings/auto-lock', {
            method: 'PUT',
            token,
            body: { minutes: Number(autoLock) },
            timeoutMs: 20000,
          });
          applySettings(data.settings);
          setNoticeTone('success');
          setNotice(t('settings.autoSaved'));
        } catch (failure) {
          handleFailure(failure);
        } finally {
          if (mounted.current) setBusy('');
        }
      }

      async function lockNow() {
        if (busy) return;
        if (!lockArmed) {
          setLockArmed(true);
          return;
        }
        setBusy('lock');
        setError(null);
        try {
          await api('/lock', { method: 'POST', token, timeoutMs: 15000 });
          writeToken('');
          setToken('');
          setLockArmed(false);
          setNoticeTone('success');
          setNotice(t('settings.lockedNow'));
          reloadSoon(700);
        } catch (failure) {
          handleFailure(failure);
        } finally {
          if (mounted.current) setBusy('');
        }
      }

      const header = h(
        'div',
        { className: 'dsh-lockbox-settings-header' },
        h(
          'div',
          {},
          h('h2', { className: 'dsh-lockbox-settings-title' }, t('settings.title')),
          h('p', { className: 'dsh-lockbox-settings-subtitle' }, t('settings.subtitle')),
        ),
        h(
          'span',
          { className: 'dsh-lockbox-state ' + (status && status.locked ? 'is-locked' : 'is-open') },
          h('span', { className: 'dsh-lockbox-state__dot' }),
          status && status.locked ? t('settings.locked') : t('settings.unlocked'),
        ),
      );

      const noticeNode = notice ? h(Alert, { tone: noticeTone }, notice) : null;
      const errorNode = error ? h(Alert, { tone: 'error' }, errorText(error)) : null;

      if (!token) {
        return h(
          'div',
          { className: 'dsh-lockbox-settings' },
          header,
          noticeNode,
          errorNode,
          h(
            'section',
            { className: 'dsh-lockbox-panel' },
            h('div', { className: 'dsh-lockbox-panel__title' }, t('settings.unlockTitle')),
            h('p', { className: 'dsh-lockbox-panel__desc' }, t('settings.unlockBody')),
            h(
              'form',
              { className: 'dsh-lockbox-settings-form', onSubmit: handleUnlock },
              h(
                Field,
                { label: t('login.password'), htmlFor: 'dsh-lockbox-settings-unlock' },
                h(PasswordInput, {
                  id: 'dsh-lockbox-settings-unlock',
                  value: unlockPassword,
                  onChange: (event) => setUnlockPassword(event.target.value),
                  autoComplete: 'current-password',
                  autoFocus: true,
                }),
              ),
              h(
                'div',
                { className: 'dsh-lockbox-settings-actions' },
                h(Button, { type: 'submit', variant: 'primary', busy: unlocking, disabled: !unlockPassword }, unlocking ? t('login.unlocking') : t('settings.unlock')),
              ),
            ),
          ),
        );
      }

      if (loading) {
        return h(
          'div',
          { className: 'dsh-lockbox-settings' },
          header,
          h('section', { className: 'dsh-lockbox-panel dsh-lockbox-panel--center' }, h(Spinner, {}), h('span', { className: 'dsh-lockbox-muted' }, t('common.loading'))),
        );
      }

      if (!settings) {
        return h(
          'div',
          { className: 'dsh-lockbox-settings' },
          header,
          noticeNode,
          errorNode || h(Alert, { tone: 'error' }, t('err.generic')),
          h(
            'div',
            { className: 'dsh-lockbox-settings-actions' },
            h(Button, { variant: 'secondary', onClick: () => load(token) }, h(IconRefresh, { size: 15 }), t('common.retry')),
          ),
        );
      }

      const hasSavedPassword = Boolean(settings.smtp && settings.smtp.hasPassword);
      const autoLockValue = autoLock === '' ? String(settings.autoLockMinutes) : autoLock;

      return h(
        'div',
        { className: 'dsh-lockbox-settings' },
        header,
        noticeNode,
        errorNode,
        h(
          'section',
          { className: 'dsh-lockbox-panel' },
          h(
            'div',
            { className: 'dsh-lockbox-panel__head' },
            h(
              'div',
              {},
              h('div', { className: 'dsh-lockbox-panel__title' }, t('settings.status')),
              h('div', { className: 'dsh-lockbox-panel__desc' }, t('settings.subtitle')),
            ),
          ),
          h(
            'dl',
            { className: 'dsh-lockbox-kv' },
            h('dt', {}, t('settings.recovery')),
            h('dd', {}, settings.email),
            h('dt', {}, t('settings.autoLock')),
            h('dd', {}, tf('settings.autoLockValue', { n: settings.autoLockMinutes })),
            h('dt', {}, t('settings.smtp')),
            h('dd', {}, settings.smtp && settings.smtp.host ? tf('settings.smtpReady', { host: settings.smtp.host }) : t('settings.smtpMissing')),
            h('dt', {}, t('settings.storage')),
            h('dd', {}, h('code', { className: 'dsh-lockbox-path' }, settings.configDir)),
          ),
          h('p', { className: 'dsh-lockbox-panel__desc dsh-lockbox-panel__desc--footer' }, tf('settings.storageHint', { dir: settings.configDir })),
        ),
        h(
          'section',
          { className: 'dsh-lockbox-panel' },
          h('div', { className: 'dsh-lockbox-panel__title' }, t('settings.passwordTitle')),
          h('p', { className: 'dsh-lockbox-panel__desc' }, t('settings.passwordBody')),
          h(
            'form',
            { className: 'dsh-lockbox-settings-form', onSubmit: savePassword },
            h(
              Field,
              { label: t('settings.current'), htmlFor: 'dsh-lockbox-settings-current' },
              h(PasswordInput, {
                id: 'dsh-lockbox-settings-current',
                value: pw.current,
                onChange: (event) => setPw(Object.assign({}, pw, { current: event.target.value })),
                autoComplete: 'current-password',
              }),
            ),
            h(
              'div',
              { className: 'dsh-lockbox-grid2' },
              h(
                Field,
                { label: t('settings.new'), htmlFor: 'dsh-lockbox-settings-new' },
                h(PasswordInput, {
                  id: 'dsh-lockbox-settings-new',
                  value: pw.next,
                  onChange: (event) => setPw(Object.assign({}, pw, { next: event.target.value })),
                  autoComplete: 'new-password',
                }),
                h(StrengthMeter, { password: pw.next }),
              ),
              h(
                Field,
                { label: t('settings.confirm'), htmlFor: 'dsh-lockbox-settings-confirm' },
                h(PasswordInput, {
                  id: 'dsh-lockbox-settings-confirm',
                  value: pw.confirm,
                  onChange: (event) => setPw(Object.assign({}, pw, { confirm: event.target.value })),
                  autoComplete: 'new-password',
                }),
              ),
            ),
            h(
              'div',
              { className: 'dsh-lockbox-settings-actions' },
              h(Button, { type: 'submit', variant: 'primary', busy: busy === 'password', disabled: !pw.current || !pw.next || !pw.confirm }, busy === 'password' ? t('settings.changing') : t('settings.change')),
            ),
          ),
        ),
        h(
          'section',
          { className: 'dsh-lockbox-panel' },
          h('div', { className: 'dsh-lockbox-panel__title' }, t('settings.emailTitle')),
          h('p', { className: 'dsh-lockbox-panel__desc' }, t('settings.emailBody')),
          h(
            'form',
            { className: 'dsh-lockbox-settings-form', onSubmit: saveEmail },
            h(
              'div',
              { className: 'dsh-lockbox-grid2' },
              h(
                Field,
                { label: t('settings.emailNew'), htmlFor: 'dsh-lockbox-settings-email' },
                h(TextInput, {
                  id: 'dsh-lockbox-settings-email',
                  type: 'email',
                  value: emailForm.email,
                  onChange: (event) => setEmailForm(Object.assign({}, emailForm, { email: event.target.value })),
                  placeholder: settings.email,
                  autoComplete: 'email',
                }),
              ),
              h(
                Field,
                { label: t('settings.current'), htmlFor: 'dsh-lockbox-settings-email-current' },
                h(PasswordInput, {
                  id: 'dsh-lockbox-settings-email-current',
                  value: emailForm.current,
                  onChange: (event) => setEmailForm(Object.assign({}, emailForm, { current: event.target.value })),
                  autoComplete: 'current-password',
                }),
              ),
            ),
            h(
              'div',
              { className: 'dsh-lockbox-settings-actions' },
              h(Button, { type: 'submit', variant: 'primary', busy: busy === 'email', disabled: !emailForm.current || !emailForm.email }, busy === 'email' ? t('common.saving') : t('settings.emailSave')),
            ),
          ),
        ),
        h(
          'section',
          { className: 'dsh-lockbox-panel' },
          h('div', { className: 'dsh-lockbox-panel__title' }, t('settings.smtpTitle')),
          h('p', { className: 'dsh-lockbox-panel__desc' }, t('settings.smtpBody')),
          h(
            'form',
            { className: 'dsh-lockbox-settings-form', onSubmit: saveSmtp },
            h(
              'div',
              { className: 'dsh-lockbox-grid2' },
              h(
                Field,
                { label: t('setup.host'), htmlFor: 'dsh-lockbox-settings-smtp-host' },
                h(TextInput, { id: 'dsh-lockbox-settings-smtp-host', value: smtp.host, onChange: (event) => setSmtp(Object.assign({}, smtp, { host: event.target.value })), placeholder: 'smtp.example.com', autoComplete: 'off' }),
              ),
              h(
                Field,
                { label: t('setup.port'), htmlFor: 'dsh-lockbox-settings-smtp-port' },
                h(TextInput, { id: 'dsh-lockbox-settings-smtp-port', type: 'number', min: 1, max: 65535, value: smtp.port, onChange: (event) => setSmtp(Object.assign({}, smtp, { port: event.target.value })), autoComplete: 'off' }),
              ),
            ),
            h(
              Field,
              { label: t('setup.security'), htmlFor: 'dsh-lockbox-settings-smtp-security' },
              h(
                'select',
                {
                  id: 'dsh-lockbox-settings-smtp-security',
                  className: 'dsh-lockbox-input',
                  value: smtp.security,
                  onChange: (event) => setSmtp(Object.assign({}, smtp, { security: event.target.value })),
                },
                h('option', { value: 'ssl' }, t('setup.security.ssl')),
                h('option', { value: 'starttls' }, t('setup.security.starttls')),
                h('option', { value: 'none' }, t('setup.security.none')),
              ),
            ),
            h(
              'div',
              { className: 'dsh-lockbox-grid2' },
              h(
                Field,
                { label: t('setup.user'), htmlFor: 'dsh-lockbox-settings-smtp-user' },
                h(TextInput, { id: 'dsh-lockbox-settings-smtp-user', value: smtp.user, onChange: (event) => setSmtp(Object.assign({}, smtp, { user: event.target.value })), placeholder: settings.email, autoComplete: 'username' }),
              ),
              h(
                Field,
                { label: t('settings.smtpPassword'), htmlFor: 'dsh-lockbox-settings-smtp-password' },
                h(PasswordInput, {
                  id: 'dsh-lockbox-settings-smtp-password',
                  value: smtp.password,
                  onChange: (event) => setSmtp(Object.assign({}, smtp, { password: event.target.value })),
                  placeholder: hasSavedPassword ? t('settings.smtpPasswordKeep') : '',
                  autoComplete: 'new-password',
                  disabled: smtp.clear,
                }),
              ),
            ),
            hasSavedPassword
              ? h(
                  'label',
                  { className: 'dsh-lockbox-check' },
                  h('input', {
                    type: 'checkbox',
                    checked: smtp.clear,
                    onChange: (event) => setSmtp(Object.assign({}, smtp, { clear: event.target.checked })),
                  }),
                  h('span', {}, t('settings.smtpClear')),
                )
              : null,
            h(
              Field,
              { label: t('setup.from'), htmlFor: 'dsh-lockbox-settings-smtp-from', optional: true },
              h(TextInput, { id: 'dsh-lockbox-settings-smtp-from', value: smtp.from, onChange: (event) => setSmtp(Object.assign({}, smtp, { from: event.target.value })), placeholder: settings.email, autoComplete: 'email' }),
            ),
            h(
              'div',
              { className: 'dsh-lockbox-settings-actions' },
              h(Button, { type: 'submit', variant: 'primary', busy: busy === 'smtp' }, busy === 'smtp' ? t('common.saving') : t('settings.smtpSave')),
              h(Button, { variant: 'secondary', onClick: sendTestEmail, busy: busy === 'test' }, busy === 'test' ? t('settings.testing') : t('settings.test')),
            ),
          ),
        ),
        h(
          'section',
          { className: 'dsh-lockbox-panel' },
          h('div', { className: 'dsh-lockbox-panel__title' }, t('settings.autoTitle')),
          h('p', { className: 'dsh-lockbox-panel__desc' }, t('settings.autoBody')),
          h(
            'form',
            { className: 'dsh-lockbox-settings-form', onSubmit: saveAutoLock },
            h(
              Field,
              { label: t('settings.autoLock'), htmlFor: 'dsh-lockbox-settings-auto' },
              h(
                'select',
                {
                  id: 'dsh-lockbox-settings-auto',
                  className: 'dsh-lockbox-input',
                  value: autoLockValue,
                  onChange: (event) => setAutoLock(event.target.value),
                },
                h('option', { value: '5' }, '5'),
                h('option', { value: '15' }, '15'),
                h('option', { value: '30' }, '30'),
                h('option', { value: '60' }, '60'),
                h('option', { value: '120' }, '120'),
              ),
            ),
            h(
              'div',
              { className: 'dsh-lockbox-settings-actions' },
              h(Button, { type: 'submit', variant: 'secondary', busy: busy === 'auto' }, busy === 'auto' ? t('common.saving') : t('settings.autoSave')),
            ),
          ),
        ),
        h(
          'section',
          { className: 'dsh-lockbox-panel dsh-lockbox-panel--danger' },
          h('div', { className: 'dsh-lockbox-panel__title' }, t('settings.lockNow')),
          h('p', { className: 'dsh-lockbox-panel__desc' }, t('settings.lockNowBody')),
          h(
            'div',
            { className: 'dsh-lockbox-settings-actions' },
            h(
              Button,
              { variant: 'danger', onClick: lockNow, busy: busy === 'lock' },
              h(IconLock, { size: 15 }),
              busy === 'lock' ? t('fab.locking') : lockArmed ? t('settings.lockConfirm') : t('settings.lockNow'),
            ),
          ),
        ),
      );
    }

    const CSS = `
.dsh-lockbox-overlay,
.dsh-lockbox-nav,
.dsh-lockbox-settings {
  --lb-bg: var(--dsw-alias-bg-base, #0b0f17);
  --lb-card: var(--dsw-alias-bg-layer-1, #141a26);
  --lb-text: var(--dsw-alias-label-primary, #e9eefb);
  --lb-muted: var(--dsw-alias-label-secondary, #a4b0c6);
  --lb-dim: var(--dsw-alias-label-tertiary, #77849b);
  --lb-border: var(--dsw-alias-border-l2, rgba(130, 150, 190, 0.24));
  --lb-blue: var(--dsw-alias-state-business-primary, #4c8dff);
  --lb-red: var(--dsw-alias-state-error-primary, #ff6b6b);
  --lb-green: var(--dsw-alias-state-success-primary, #42c98b);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
}
.dsh-lockbox-overlay *,
.dsh-lockbox-nav,
.dsh-lockbox-nav *,
.dsh-lockbox-settings * {
  box-sizing: border-box;
}

.dsh-lockbox-overlay {
  position: fixed;
  inset: 0;
  z-index: 2147483000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px 16px;
  overflow: auto;
  isolation: isolate;
  background:
    radial-gradient(900px 520px at 12% 0%, rgba(76, 141, 255, 0.18), transparent 62%),
    radial-gradient(720px 520px at 92% 100%, rgba(122, 92, 255, 0.13), transparent 64%),
    var(--lb-bg);
  color: var(--lb-text);
}

.dsh-lockbox-glow {
  position: fixed;
  z-index: 0;
  width: 280px;
  height: 280px;
  border-radius: 50%;
  pointer-events: none;
  filter: blur(80px);
  opacity: 0.5;
}
.dsh-lockbox-glow--one {
  top: -90px;
  left: 8%;
  background: rgba(76, 141, 255, 0.28);
}
.dsh-lockbox-glow--two {
  right: 4%;
  bottom: -110px;
  background: rgba(126, 92, 255, 0.22);
}

.dsh-lockbox-card {
  position: relative;
  z-index: 1;
  width: min(440px, 100%);
  max-height: calc(100vh - 48px);
  overflow: auto;
  padding: 28px;
  border: 1px solid var(--lb-border);
  border-radius: 20px;
  background: var(--lb-card);
  box-shadow: 0 30px 90px rgba(0, 0, 0, 0.34), inset 0 1px 0 rgba(255, 255, 255, 0.05);
  animation: dsh-lockbox-in 180ms ease-out both;
}
.dsh-lockbox-card--wide {
  width: min(540px, 100%);
}
.dsh-lockbox-card--center {
  text-align: center;
}
.dsh-lockbox-card::-webkit-scrollbar {
  width: 8px;
}
.dsh-lockbox-card::-webkit-scrollbar-thumb {
  background: var(--lb-border);
  border-radius: 8px;
}

.dsh-lockbox-brand {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 18px;
}
.dsh-lockbox-brand--compact {
  margin-bottom: 0;
}
.dsh-lockbox-brand__mark {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 42px;
  height: 42px;
  flex: none;
  border-radius: 13px;
  background: linear-gradient(145deg, #5b9bff, #345fd8);
  color: #fff;
  box-shadow: 0 8px 22px rgba(76, 141, 255, 0.32);
}
.dsh-lockbox-brand--compact .dsh-lockbox-brand__mark {
  width: 32px;
  height: 32px;
  border-radius: 10px;
}
.dsh-lockbox-brand__text {
  min-width: 0;
}
.dsh-lockbox-brand__name {
  font-size: 14.5px;
  font-weight: 650;
  letter-spacing: 0.01em;
}
.dsh-lockbox-brand__tagline {
  margin-top: 2px;
  font-size: 10.5px;
  color: var(--lb-muted);
}

.dsh-lockbox-heading {
  margin-bottom: 18px;
}
.dsh-lockbox-title {
  margin: 0;
  font-size: 24px;
  line-height: 1.25;
  font-weight: 650;
  letter-spacing: -0.02em;
}
.dsh-lockbox-subtitle {
  margin: 7px 0 0;
  font-size: 12.5px;
  line-height: 1.65;
  color: var(--lb-muted);
}

.dsh-lockbox-steps {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 16px 0 20px;
  font-size: 10.5px;
  color: var(--lb-dim);
}
.dsh-lockbox-step {
  display: flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
}
.dsh-lockbox-step.is-active {
  color: var(--lb-text);
}
.dsh-lockbox-step.is-done {
  color: var(--lb-green);
}
.dsh-lockbox-step__dot {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  flex: none;
  border: 1px solid var(--lb-border);
  border-radius: 50%;
  font-size: 9.5px;
}
.dsh-lockbox-step.is-active .dsh-lockbox-step__dot {
  border-color: transparent;
  background: var(--lb-blue);
  color: #fff;
}
.dsh-lockbox-step.is-done .dsh-lockbox-step__dot {
  border-color: currentColor;
}
.dsh-lockbox-step__line {
  flex: 1;
  min-width: 12px;
  height: 1px;
  background: var(--lb-border);
}

.dsh-lockbox-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin-top: 18px;
}
.dsh-lockbox-form > .dsh-lockbox-btn {
  width: 100%;
}
.dsh-lockbox-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}
.dsh-lockbox-field__label {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  font-size: 11.5px;
  font-weight: 550;
  color: var(--lb-muted);
}
.dsh-lockbox-field__optional {
  font-size: 9.5px;
  font-weight: 400;
  color: var(--lb-dim);
}
.dsh-lockbox-field__hint {
  font-size: 10.5px;
  line-height: 1.5;
  color: var(--lb-dim);
}
.dsh-lockbox-field__hint--standalone {
  margin-top: -4px;
}

.dsh-lockbox-input {
  width: 100%;
  height: 40px;
  padding: 0 12px;
  border: 1px solid var(--lb-border);
  border-radius: 10px;
  outline: none;
  background: var(--dsw-alias-bg-base, rgba(8, 12, 20, 0.55));
  color: var(--lb-text);
  font: inherit;
  font-size: 13px;
  transition: border-color 160ms ease, box-shadow 160ms ease;
}
.dsh-lockbox-input:hover:not(:disabled) {
  border-color: var(--dsw-alias-border-l1, rgba(150, 170, 210, 0.42));
}
.dsh-lockbox-input:focus {
  border-color: var(--lb-blue);
  box-shadow: 0 0 0 3px rgba(76, 141, 255, 0.18);
}
.dsh-lockbox-input:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
select.dsh-lockbox-input {
  padding-right: 30px;
}

.dsh-lockbox-password {
  position: relative;
  display: flex;
  min-width: 0;
}
.dsh-lockbox-input--password {
  padding-right: 44px;
}
.dsh-lockbox-eye {
  position: absolute;
  top: 50%;
  right: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 32px;
  transform: translateY(-50%);
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--lb-dim);
  cursor: pointer;
}
.dsh-lockbox-eye:hover {
  background: var(--dsw-alias-interactive-bg-hover, rgba(255, 255, 255, 0.07));
  color: var(--lb-text);
}

.dsh-lockbox-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  height: 38px;
  padding: 0 16px;
  border: 1px solid transparent;
  border-radius: 10px;
  font: inherit;
  font-size: 12.5px;
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
  user-select: none;
  transition: filter 160ms ease, background 160ms ease, border-color 160ms ease, transform 160ms ease;
}
.dsh-lockbox-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.dsh-lockbox-btn--primary {
  background: linear-gradient(180deg, #5b9bff, #3d74e8);
  color: #fff;
  box-shadow: 0 8px 20px rgba(61, 116, 232, 0.26);
}
.dsh-lockbox-btn--primary:hover:not(:disabled) {
  filter: brightness(1.06);
}
.dsh-lockbox-btn--secondary {
  border-color: var(--lb-border);
  background: var(--dsw-alias-interactive-bg-hover, rgba(255, 255, 255, 0.06));
  color: var(--lb-text);
}
.dsh-lockbox-btn--secondary:hover:not(:disabled) {
  background: var(--dsw-alias-interactive-bg-active, rgba(255, 255, 255, 0.1));
}
.dsh-lockbox-btn--ghost {
  background: transparent;
  color: var(--lb-muted);
}
.dsh-lockbox-btn--ghost:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.06);
  color: var(--lb-text);
}
.dsh-lockbox-btn--danger {
  border-color: rgba(255, 107, 107, 0.35);
  background: rgba(255, 107, 107, 0.12);
  color: var(--lb-red);
}
.dsh-lockbox-btn--danger:hover:not(:disabled) {
  background: rgba(255, 107, 107, 0.18);
}

.dsh-lockbox-alert {
  display: flex;
  gap: 9px;
  margin: 10px 0;
  padding: 10px 12px;
  border: 1px solid transparent;
  border-radius: 10px;
  font-size: 11.5px;
  line-height: 1.55;
}
.dsh-lockbox-alert--info {
  border-color: rgba(76, 141, 255, 0.24);
  background: rgba(76, 141, 255, 0.09);
  color: var(--lb-text);
}
.dsh-lockbox-alert--success {
  border-color: rgba(66, 201, 139, 0.26);
  background: rgba(66, 201, 139, 0.09);
  color: var(--lb-text);
}
.dsh-lockbox-alert--warning {
  border-color: rgba(240, 180, 76, 0.28);
  background: rgba(240, 180, 76, 0.09);
  color: var(--lb-text);
}
.dsh-lockbox-alert--error {
  border-color: rgba(255, 107, 107, 0.28);
  background: rgba(255, 107, 107, 0.09);
  color: var(--lb-text);
}
.dsh-lockbox-alert__icon {
  flex: none;
  margin-top: 1px;
  color: var(--lb-muted);
}
.dsh-lockbox-alert--success .dsh-lockbox-alert__icon {
  color: var(--lb-green);
}
.dsh-lockbox-alert--warning .dsh-lockbox-alert__icon {
  color: #f0b44c;
}
.dsh-lockbox-alert--error .dsh-lockbox-alert__icon {
  color: var(--lb-red);
}
.dsh-lockbox-alert__body {
  min-width: 0;
  word-break: break-word;
}
.dsh-lockbox-alert__meta {
  display: block;
  margin-top: 2px;
  opacity: 0.8;
}

.dsh-lockbox-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-top: 4px;
}
.dsh-lockbox-actions--split {
  align-items: flex-end;
}
.dsh-lockbox-actions__right {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}
.dsh-lockbox-secure {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--lb-dim);
  font-size: 10px;
}

.dsh-lockbox-grid2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.dsh-lockbox-login-footer {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 14px;
  font-size: 11px;
}
.dsh-lockbox-link {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--lb-blue);
  font: inherit;
  font-size: 11.5px;
  cursor: pointer;
}
.dsh-lockbox-link:hover {
  text-decoration: underline;
}
.dsh-lockbox-muted {
  color: var(--lb-muted);
  font-size: 11px;
}
.dsh-lockbox-recovery {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-bottom: 8px;
  padding: 8px 10px;
  border-radius: 8px;
  background: rgba(76, 141, 255, 0.07);
  color: var(--lb-muted);
  font-size: 11px;
}

.dsh-lockbox-strength {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 3px;
}
.dsh-lockbox-strength__bars {
  display: flex;
  flex: 1;
  gap: 3px;
}
.dsh-lockbox-strength__bar {
  flex: 1;
  height: 3px;
  border-radius: 3px;
  background: var(--lb-border);
}
.dsh-lockbox-strength__bar.is-on {
  background: var(--lb-blue);
}
.dsh-lockbox-strength__bar.is-strong {
  background: var(--lb-green);
}
.dsh-lockbox-strength__label {
  min-width: 24px;
  color: var(--lb-dim);
  font-size: 9.5px;
  text-align: right;
}

.dsh-lockbox-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 28px 0 8px;
  color: var(--lb-muted);
  font-size: 12.5px;
}
.dsh-lockbox-spinner {
  display: inline-block;
  width: 20px;
  height: 20px;
  flex: none;
  border: 2px solid var(--lb-border);
  border-top-color: var(--lb-blue);
  border-radius: 50%;
  animation: dsh-lockbox-spin 800ms linear infinite;
}
.dsh-lockbox-spinner--small {
  width: 13px;
  height: 13px;
}
.dsh-lockbox-path {
  display: inline-block;
  padding: 5px 7px;
  border: 1px solid var(--lb-border);
  border-radius: 6px;
  background: var(--dsw-alias-bg-base, rgba(255, 255, 255, 0.05));
  color: var(--lb-muted);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 10px;
  word-break: break-all;
}
.dsh-lockbox-section-note {
  margin: 0;
  color: var(--lb-dim);
  font-size: 10.5px;
  line-height: 1.6;
}
.dsh-lockbox-inline-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: -4px;
}

.dsh-lockbox-settings {
  max-width: 760px;
  padding: 6px 0 36px;
  color: var(--lb-text);
}
.dsh-lockbox-settings-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}
.dsh-lockbox-settings-title {
  margin: 0;
  font-size: 19px;
  line-height: 1.3;
  font-weight: 650;
  letter-spacing: -0.01em;
}
.dsh-lockbox-settings-subtitle {
  margin: 4px 0 0;
  color: var(--lb-muted);
  font-size: 11.5px;
  line-height: 1.6;
}
.dsh-lockbox-panel {
  margin-top: 12px;
  padding: 16px;
  border: 1px solid var(--lb-border);
  border-radius: 14px;
  background: var(--lb-card);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}
.dsh-lockbox-panel--center {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 9px;
  padding: 22px;
  color: var(--lb-muted);
  font-size: 11.5px;
}
.dsh-lockbox-panel--danger {
  border-color: rgba(255, 107, 107, 0.28);
  background: linear-gradient(180deg, rgba(255, 107, 107, 0.06), transparent), var(--lb-card);
}
.dsh-lockbox-panel__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}
.dsh-lockbox-panel__title {
  font-size: 13px;
  font-weight: 650;
}
.dsh-lockbox-panel__desc {
  margin: 5px 0 0;
  color: var(--lb-muted);
  font-size: 11px;
  line-height: 1.6;
}
.dsh-lockbox-panel__desc--footer {
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid var(--lb-border);
}
.dsh-lockbox-kv {
  display: grid;
  grid-template-columns: 118px minmax(0, 1fr);
  gap: 9px 12px;
  align-items: baseline;
  margin: 14px 0 0;
  font-size: 12px;
}
.dsh-lockbox-kv dt {
  color: var(--lb-muted);
  font-size: 11px;
}
.dsh-lockbox-kv dd {
  margin: 0;
  color: var(--lb-text);
  word-break: break-word;
}
.dsh-lockbox-state {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 24px;
  flex: none;
  padding: 0 9px;
  border: 1px solid var(--lb-border);
  border-radius: 999px;
  color: var(--lb-muted);
  font-size: 10px;
  white-space: nowrap;
}
.dsh-lockbox-state__dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--lb-red);
  box-shadow: 0 0 0 3px rgba(255, 107, 107, 0.12);
}
.dsh-lockbox-state.is-open {
  color: var(--lb-green);
}
.dsh-lockbox-state.is-open .dsh-lockbox-state__dot {
  background: var(--lb-green);
  box-shadow: 0 0 0 3px rgba(66, 201, 139, 0.12);
}
.dsh-lockbox-settings-form {
  display: flex;
  flex-direction: column;
  gap: 11px;
  margin-top: 13px;
}
.dsh-lockbox-settings-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-top: 3px;
}
.dsh-lockbox-settings-actions .dsh-lockbox-btn {
  width: auto;
}
.dsh-lockbox-check {
  display: flex;
  align-items: center;
  gap: 7px;
  color: var(--lb-muted);
  font-size: 11px;
  cursor: pointer;
  user-select: none;
}
.dsh-lockbox-check input {
  width: 14px;
  height: 14px;
  accent-color: var(--lb-blue);
}

.dsh-lockbox-nav {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: 0;
  border-radius: 9px;
  background: transparent;
  color: var(--dsw-alias-label-secondary, #a4b0c6);
  font: inherit;
  cursor: pointer;
  transition: background 140ms ease, color 140ms ease;
}
.dsh-lockbox-nav:hover {
  background: var(--dsw-alias-bg-layer-2, rgba(255, 255, 255, 0.08));
  color: var(--dsw-alias-label-primary, #e9eefb);
}
.dsh-lockbox-nav:focus-visible {
  outline: 2px solid var(--dsw-alias-state-business-primary, #4c8dff);
  outline-offset: 1px;
}
.dsh-lockbox-nav:disabled {
  opacity: 0.55;
  cursor: default;
}
.dsh-lockbox-nav--wide {
  justify-content: flex-start;
  gap: 8px;
  width: 100%;
  padding: 0 8px;
  font-size: 14px;
  font-weight: 450;
  color: var(--dsw-alias-label-primary, #e9eefb);
}
.dsh-lockbox-nav--wide:hover {
  color: var(--dsw-alias-label-primary, #e9eefb);
}
.dsh-lockbox-nav-label {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

@keyframes dsh-lockbox-spin {
  to { transform: rotate(360deg); }
}
@keyframes dsh-lockbox-in {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: none; }
}
@keyframes dsh-lockbox-pop {
  from { opacity: 0; transform: translateY(4px) scale(0.98); }
  to { opacity: 1; transform: none; }
}

@media (max-width: 560px) {
  .dsh-lockbox-overlay {
    align-items: flex-start;
    padding: 16px 10px;
  }
  .dsh-lockbox-card {
    margin: auto;
    padding: 22px 18px;
    border-radius: 16px;
  }
  .dsh-lockbox-grid2 {
    grid-template-columns: 1fr;
  }
  .dsh-lockbox-actions--split {
    flex-direction: column;
    align-items: stretch;
  }
  .dsh-lockbox-actions__right {
    justify-content: flex-end;
  }
  .dsh-lockbox-settings-header {
    flex-direction: column;
  }
  .dsh-lockbox-kv {
    grid-template-columns: 100px minmax(0, 1fr);
  }
}

@media (prefers-reduced-motion: reduce) {
  .dsh-lockbox-card {
    animation: none;
  }
  .dsh-lockbox-spinner {
    animation-duration: 1.6s;
  }
}
`;

    function injectCss() {
      if (typeof document === 'undefined') return () => {};
      const selector = 'style[data-plugin-css="dsh-lockbox/style.css"]';
      const existing = document.querySelector(selector);
      if (existing) return () => {};
      const style = document.createElement('style');
      style.setAttribute('data-plugin-css', 'dsh-lockbox/style.css');
      style.textContent = CSS;
      document.head.appendChild(style);
      return () => {
        if (style.parentNode) style.parentNode.removeChild(style);
      };
    }

    function apply(ctx) {
      ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-lockbox: dictionaries');
      t = ctx.locale.bind(NS);
      ctx.effect(() => injectCss(), 'dsh-lockbox: styles');

      ctx.slots.inject('shell.overlay', function* () {
        yield ctx.slots.register(
          { name: 'shell.overlay', id: 'lockbox', order: 5000 },
          () => h(LockboxOverlay, {}),
        );
      });

      // 左下角栏的「加密模式」入口：与设置按钮同一排，一键上锁。
      ctx.slots.inject('sidebar.footer.action', function* () {
        yield ctx.slots.register(
          {
            name: 'sidebar.footer.action',
            id: 'lockbox-lock',
            order: -50,
            label: () => t('nav.lock'),
            inject: () => ({ t }),
          },
          SidebarLockAction,
        );
      });

      ctx.slots.inject('settings.section', function* () {
        yield ctx.slots.register(
          {
            name: 'settings.section',
            id: 'lockbox-security',
            order: 70,
            label: () => t('settings.nav'),
            inject: () => ({ t }),
          },
          SettingsSection,
        );
      });
    }

    return { name: 'lockbox', inject: ['slots', 'locale'], apply };
  },
});
