# 我们的小宇宙 · 情侣网站

一个只属于两个人的小空间：时光相册、心动小游戏、悄悄话、我们的日记和主题换色。

支持两种运行方式：

- **本地文件版**：双击 `index.html`，数据存在浏览器 localStorage。
- **联网共享版**：启动自带的小服务器，用网址访问，两个人的数据实时共享（约 5 秒同步）。

---

## 一、同一 Wi-Fi 下用网址访问（现在就能用）

1. 双击 `启动服务器.bat`。
2. 命令行会显示：
   - 本机：`http://localhost:5080`
   - 局域网：`http://<电脑 IPv4>:5080`
3. 手机 / 另一台电脑连同一个 Wi-Fi，打开局域网地址即可。
4. 需要停止时双击 `停止服务器.bat`。

当前这台电脑的局域网地址是：

```
http://192.168.172.135:5080
```

> IP 可能会变，以启动脚本输出的地址为准。Windows 防火墙已添加 `Couple Space 5080` 入站规则；如果仍然打不开，检查路由器是否开启了“AP 隔离/访客网络隔离”。

联网版的数据保存在：

```
server/data/state.json
```

两台设备打开同一个网址后，日记、悄悄话、照片、主题、资料都会通过服务器共享。

---

## 二、部署到公网（真正的任意网络访问）

项目已经包含 `Dockerfile`，推荐用带持久化磁盘的平台：Render、Railway、Fly.io 或自己的 VPS。

### Docker 方式

```bash
docker build -t couple-space .
docker run -d --name couple-space \
  -p 8080:8080 \
  -v couple-data:/data \
  -e COUPLE_KEY=换成你们的访问口令 \
  couple-space
```

然后访问 `http://服务器IP:8080/?key=换成你们的访问口令`。

- 必须挂载 `/data`，否则容器重启后数据会丢。
- `PORT`：监听端口，默认 5080；Docker 镜像内默认 8080。
- `DATA_DIR`：数据目录，Docker 镜像内默认 `/data`。
- `COUPLE_KEY`：可选访问口令。设置后 API 需要 `X-Couple-Key`，分享带 `?key=...` 的链接即可。

### Render 固定公网网址（推荐）

项目已经带好 `render.yaml`，用 Render 的 **Blueprint** 可以直接创建：

1. 新建一个 GitHub 仓库，把**本目录里的内容**（`index.html`、`assets/`、`server/`、`Dockerfile`、`render.yaml`）放到仓库根目录。
2. 打开 Render Dashboard → **New → Blueprint**，连接这个仓库。
3. Render 会读取 `render.yaml`，创建：
   - Docker Web Service
   - 1GB 持久化磁盘挂载到 `/data`
   - `DATA_DIR=/data`
   - 健康检查 `/api/health`
4. 在环境变量里填写 `COUPLE_KEY`（你们的访问口令），不要留空。
5. 点击 Deploy，等待 5～10 分钟。
6. 固定网址是：

```
https://<你的服务名>.onrender.com/?key=<COUPLE_KEY>
```

`render.yaml` 默认使用 `plan: starter`，因为 **Render 的免费实例不支持持久化磁盘**：

- Starter + 1GB disk：数据永久保存，网址固定，适合长期使用。
- Free：可以部署，但没有磁盘，重新部署/实例重启后数据会丢；只能靠页面底部的「导出备份」手动保存。
- 免费实例长时间无访问会休眠，再次打开会有几十秒冷启动。

如果 `our-little-universe` 这个名字已被占用，Render 会让你换一个名字，网址里的子域名也会跟着变。绑定自定义域名后，网址可以更短。

### 其他平台

Railway、Fly.io、VPS 也可以用同一个 Dockerfile，核心只有两点：**注入 `PORT`，把 `/data` 挂成持久化磁盘**。

### 临时公网隧道

如果只想临时给另一台设备看，可以用 Cloudflare Tunnel：

```bash
cloudflared tunnel --url http://localhost:5080
```

它会输出一个临时的 `https://xxx.trycloudflare.com` 地址。电脑关机或隧道进程停止后地址失效。

### 纯静态托管（GitHub Pages / Netlify）

也可以只把 `index.html + assets` 传上去，会得到一个公开网址，但**数据仍然只存在每台设备自己的浏览器里**，两个人不会同步。需要共享数据时请用上面的服务器方式。

---

## 三、访问口令（建议公网开启）

启动服务器时设置环境变量：

```powershell
$env:COUPLE_KEY = "your-secret"
.\启动服务器.bat
```

然后访问：

```
http://localhost:5080/?key=your-secret
```

前端会把口令存到 localStorage，后续请求自动带上 `X-Couple-Key`。没有口令时 API 返回 401，只能看到本地缓存。

---

## 四、功能

- **A LETTER FOR YOU**：信纸卡片 + 信封，点击拆开一封信
- **时光相册**：三张手绘拍立得，支持上传 / 删除照片，照片说明可随时修改
- **心动小游戏**：6 对翻牌配对，统计次数，集齐后撒花
- **悄悄话**：昵称 + 留言，留言墙按时间展示，可删除
- **我们的日记**：新增 / 编辑 / 删除 / 展开阅读
- **纪念日**：纪念日、生日、见面倒数，可添加 / 编辑 / 删除
- **心愿清单**：一起完成的小事，支持添加、勾选、编辑、删除和进度条
- **定制我们的故事**：双方名字、纪念日，页脚显示在一起天数
- **主题换色**：奶油粉、薄荷绿、晴空蓝、奶油黄、淡薰衣草
- **备份 / 恢复**：页脚可导出完整 JSON 备份，也可以导入恢复
- 响应式，手机 / 平板 / 桌面均可使用

## 五、数据说明

| 位置 | 内容 |
| --- | --- |
| `server/data/state.json` | 联网版的共享数据（主题 / 资料 / 日记 / 悄悄话 / 照片 / 纪念日 / 心愿） |
| `server/data/state.json.bak` | 每次写入前自动保留的上一版备份 |
| 浏览器 `littleUniverse.*` | 本地缓存，断网时仍可查看 |
| 浏览器 `littleUniverse.key` | 访问口令（如果设置了 `COUPLE_KEY`） |

### 永久保存 / 自己更改

- 联网版每次修改都会写入 `server/data/state.json`，重启服务器后仍然保留。
- 服务器采用“临时文件 + 原子替换”，并在写入前保留 `state.json.bak`；如果主文件损坏，会自动尝试读取备份。
- 页面底部提供 **导出备份 / 导入备份**，可以手动保存一份完整 JSON，换电脑或重装时恢复。
- 公网部署时务必给 `/data` 挂载持久化磁盘，否则平台重启容器会丢失数据。
- 网页里的照片、说明、日记、悄悄话、纪念日、心愿都可以再编辑或删除。

恢复初始状态：

1. 停止服务器，删除 `server/data/state.json` 和 `server/data/state.json.bak`。
2. 浏览器开发者工具 → Application → Local Storage → 删除 `littleUniverse.*`。
3. 重新启动并刷新。

## 六、文件结构

```
博客/
├── index.html               # 页面
├── assets/
│   ├── style.css            # 主题 / 布局 / 组件
│   ├── app.js               # 本地逻辑 + 服务器同步
│   └── favicon.svg
├── server/
│   ├── CoupleSpace.Server.csproj
│   ├── Program.cs           # 静态站点 + /api/state
│   └── data/                # 运行后生成 state.json / state.json.bak
├── Dockerfile
├── render.yaml               # Render Blueprint（固定网址 + 持久化磁盘）
├── start-server.ps1
├── 启动服务器.bat
├── 停止服务器.bat
├── README.md
└── *.jpg                    # 原始设计参考图
```

## 七、接口

- `GET /api/health` → `{ "ok": true }`
- `GET /api/version` → `{ "updatedAt": ... }`（轻量轮询版本号）
- `GET /api/state` → 当前共享状态
- `PUT /api/state` → 覆盖保存状态（自动写入 `updatedAt`）

前端每 5 秒轮询一次；任何一端修改后，另一端最多约 5 秒看到更新。

## 八、开发 / 自测

```bash
cd server
dotnet run
```

- `?selftest=1`：运行前端自测并把结果输出在左下角。
- `?theme=mint`：预览指定主题。
- `?modal=themeModal` / `?modal=diaryModal`：直接打开弹窗。
- `?still=1`：关闭动画，便于截图。
