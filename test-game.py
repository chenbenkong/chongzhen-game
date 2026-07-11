from playwright.sync_api import sync_playwright
import time

with sync_playwright() as p:
    browser = p.chromium.launch(headless=False)
    page = browser.new_page()
    
    # 捕获控制台日志
    logs = []
    page.on("console", lambda msg: logs.append(f"[{msg.type}] {msg.text}"))
    page.on("pageerror", lambda err: logs.append(f"[ERROR] {err}"))
    
    print("正在打开游戏...")
    page.goto('http://localhost:5175/')
    page.wait_for_load_state('networkidle')
    time.sleep(1)
    
    # 截图 - 初始页面
    page.screenshot(path='c:/Users/moli/Desktop/Trae/chongzhen-game/screenshot-1-title.png')
    print("已截图: 标题页面")
    
    # 点击"开始游戏"
    print("点击开始游戏...")
    page.click('text=开 始 游 戏')
    page.wait_for_load_state('networkidle')
    time.sleep(1)
    
    # 截图 - 输入名字
    page.screenshot(path='c:/Users/moli/Desktop/Trae/chongzhen-game/screenshot-2-name.png')
    print("已截图: 输入名字页面")
    
    # 输入名字
    print("输入名字...")
    page.fill('input', '测试玩家')
    page.click('text=确 认')
    page.wait_for_load_state('networkidle')
    time.sleep(1)
    
    # 截图 - 选择出身
    page.screenshot(path='c:/Users/moli/Desktop/Trae/chongzhen-game/screenshot-3-origin.png')
    print("已截图: 选择出身页面")
    
    # 选择"寒门"
    print("选择寒门...")
    page.click('text=寒门')
    page.wait_for_load_state('networkidle')
    time.sleep(1)
    
    # 截图 - 科举考试
    page.screenshot(path='c:/Users/moli/Desktop/Trae/chongzhen-game/screenshot-4-exam.png')
    print("已截图: 科举考试页面")
    
    # 点击进入考场
    print("点击进入考场...")
    page.click('text=进 入 考 场')
    page.wait_for_load_state('networkidle')
    time.sleep(1)
    
    # 连续答题通过所有考试
    for stage in range(6):
        print(f"正在完成第 {stage + 1} 场考试...")
        
        # 每轮考试有3道题
        for q in range(3):
            # 选择第一个选项
            page.locator('button').filter(has_text='A.').first.click()
            time.sleep(0.5)
            # 点击确定答案
            page.click('text=确 定 答 案')
            time.sleep(0.5)
            # 点击下一题或查看结果
            if q < 2:
                page.click('text=下一题')
            else:
                page.click('text=查看本场结果')
            time.sleep(0.5)
        
        # 进入下一场或完成
        if stage < 5:
            page.click('text=进入下一场考试')
        else:
            page.click('text=金榜题名')
        
        page.wait_for_load_state('networkidle')
        time.sleep(1)
    
    # 截图 - 游戏主界面（这里可能会黑屏）
    print("科举完成，进入游戏主界面...")
    time.sleep(2)
    page.screenshot(path='c:/Users/moli/Desktop/Trae/chongzhen-game/screenshot-5-game.png', full_page=True)
    print("已截图: 游戏主界面")
    
    # 打印所有日志
    print("\n=== 控制台日志 ===")
    for log in logs:
        print(log)
    
    browser.close()
    print("\n测试完成!")
