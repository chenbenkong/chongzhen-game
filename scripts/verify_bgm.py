"""验证 BGM 按钮是否渲染 + 抓 console 错误 + 测 FPS"""
from playwright.sync_api import sync_playwright
import time

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1280, "height": 800})

    console_logs = []
    page_errors = []
    page.on("console", lambda msg: console_logs.append(f"[{msg.type}] {msg.text}"))
    page.on("pageerror", lambda err: page_errors.append(str(err)))

    print("=== 访问 5173 ===")
    page.goto("http://localhost:5173", wait_until="networkidle", timeout=30000)
    page.wait_for_timeout(3000)

    # 抓 BGM 按钮
    print("\n=== BGM 按钮检测 ===")
    fixed_btns = page.locator(".bgm-toggle--fixed").all()
    inline_btns = page.locator(".bgm-toggle--inline").all()
    print(f"fixed BGM 按钮: {len(fixed_btns)}")
    for b in fixed_btns:
        bbox = b.bounding_box()
        print(f"  bbox: {bbox}")
        print(f"  text: {b.inner_text()[:50]}")

    print(f"\ninline BGM 按钮: {len(inline_btns)}")

    # 抓 title 元素
    print("\n=== title-screen 内部元素 ===")
    title_screen = page.locator(".title-screen")
    if title_screen.count() > 0:
        ts = title_screen.first
        print(f"title-screen 存在, bbox: {ts.bounding_box()}")
        # 列出所有直接子元素
        children = ts.locator(":scope > *").all()
        print(f"title-screen 直接子元素数: {len(children)}")
        for i, c in enumerate(children[:15]):
            tag = c.evaluate("el => el.tagName + (el.className ? '.' + el.className.split(' ').join('.') : '')")
            print(f"  [{i}] {tag}")
    else:
        print("title-screen 不存在!")

    # 抓 root 内容
    root = page.locator("#root")
    root_html_len = len(root.inner_html())
    print(f"\n#root 内部 HTML 长度: {root_html_len}")

    # 截屏
    page.screenshot(path="/tmp/title-screen.png", full_page=False)
    print("\n截图保存到 /tmp/title-screen.png")

    # 测 FPS - 用 requestAnimationFrame 数帧
    print("\n=== FPS 测试 ===")
    fps = page.evaluate("""
        () => new Promise(resolve => {
            let frames = 0;
            const start = performance.now();
            function tick() {
                frames++;
                if (performance.now() - start < 1000) {
                    requestAnimationFrame(tick);
                } else {
                    resolve(frames);
                }
            }
            requestAnimationFrame(tick);
        })
    """)
    print(f"主菜单 FPS: {fps}")

    # 模拟滑动（在主菜单上做 wheel）
    print("\n=== 模拟滚动 ===")
    try:
        page.mouse.wheel(0, 500)
        page.wait_for_timeout(500)
        fps2 = page.evaluate("""
            () => new Promise(resolve => {
                let frames = 0;
                const start = performance.now();
                function tick() {
                    frames++;
                    if (performance.now() - start < 1000) {
                        requestAnimationFrame(tick);
                    } else {
                        resolve(frames);
                    }
                }
                requestAnimationFrame(tick);
            })
        """)
        print(f"滚动后 FPS: {fps2}")
    except Exception as e:
        print(f"滚动测失败: {e}")

    print("\n=== Console 日志 ===")
    for log in console_logs[-30:]:
        print(log)

    print("\n=== Page 错误 ===")
    for err in page_errors:
        print(err)

    browser.close()
print("\n=== 完成 ===")
