from pathlib import Path
from playwright.sync_api import sync_playwright


def main():
    console_errors = []
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1440, "height": 1000})
        page.on("console", lambda message: console_errors.append(message.text) if message.type == "error" else None)
        page.goto("http://127.0.0.1:4173", wait_until="networkidle")

        for label in ["决策总览", "数据工坊", "组织洞察", "复核工作台", "行动中心", "管理报告"]:
            assert page.get_by_role("link", name=label).count() == 1, f"缺少导航：{label}"

        page.get_by_role("link", name="组织洞察").click()
        page.wait_for_load_state("networkidle")
        organization_select = page.locator(".global-context select").first
        organization_select.select_option(label="数字科技中心")
        page.wait_for_timeout(300)
        assert organization_select.input_value() == "数字科技中心"
        page.locator(".context-pills").get_by_text("数字科技中心", exact=True).wait_for()

        page.get_by_role("link", name="复核工作台").click()
        page.locator(".queue-table tbody tr").first.click()
        drawer = page.locator(".case-drawer")
        drawer.wait_for()
        drawer.locator(".review-options button").filter(has_text="确认").click()
        drawer.locator("textarea").fill("业务背景与当前证据一致，进入支持性行动评估。")
        drawer.get_by_role("button", name="保存复核结论").click()
        drawer.get_by_text("复核结论已保存，可按已保存状态继续流转。").wait_for()

        drawer.locator(".case-head .icon-button").click()
        page.reload(wait_until="networkidle")
        page.locator(".global-context select").first.select_option(label="数字科技中心")
        page.wait_for_timeout(300)
        page.locator(".queue-table tbody tr").first.click()
        assert page.locator(".case-drawer textarea").input_value() == "业务背景与当前证据一致，进入支持性行动评估。"
        page.locator(".case-drawer .case-head .icon-button").click()

        page.get_by_role("link", name="行动中心").click()
        page.get_by_role("heading", name="建议只有进入负责人、期限与观察指标，才算行动").wait_for()
        page.get_by_role("link", name="管理报告").click()
        page.get_by_role("button", name="确认AI摘要").wait_for()

        page.wait_for_timeout(900)
        page.screenshot(path="/tmp/retention-os-complete-frontend.png", full_page=True)
        browser.close()

    assert not console_errors, f"浏览器控制台错误：{console_errors}"
    print("PASS: 完整导航、组织下钻、复核保存/刷新恢复、行动与报告入口均正常")
    print("SCREENSHOT: /tmp/retention-os-complete-frontend.png")


if __name__ == "__main__":
    main()
