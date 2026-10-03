#!/usr/bin/env python3
"""生成 Electron 打包所需的桌面图标。

复用 public/icons 的同一套「明」印章设计，因此 Web 图标与桌面图标视觉一致，
不会出现"桌面版是默认 Electron 图标"的割裂感。

产出：
    desktop/build/icon.png   512x512   （electron-builder 的 linux.icon）
    desktop/build/icon.ico   多尺寸    （electron-builder 的 win.icon，含 256x256）

不产出 icon.icns：Pillow 无法写出 ICNS，macOS 图标需要在 macOS 上用
`iconutil` 从 iconset 生成。mac 目标请参见 electron-builder.yml 里的说明。

用法（仓库根目录）：
    python scripts/generate-desktop-icons.py
"""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
# generate-icons.py 的文件名带连字符，无法按模块名 import，因此走 importlib 按路径加载，
# 复用其中的 render_seal()，避免把印章绘制逻辑复制成两份。
GENERATOR_PATH = Path(__file__).resolve().with_name("generate-icons.py")
BUILD_DIR = ROOT / "desktop" / "build"

# Windows .ico 建议包含从 16 到 256 的完整尺寸集合
ICO_SIZES = [(256, 256), (128, 128), (64, 64), (48, 48), (32, 32), (16, 16)]
LINUX_PNG_SIZE = 512


def load_generator():
    spec = importlib.util.spec_from_file_location("chongzhen_generate_icons", GENERATOR_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"无法加载图标生成器：{GENERATOR_PATH}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def main() -> int:
    if not GENERATOR_PATH.exists():
        print(f"[错误] 找不到 {GENERATOR_PATH}", file=sys.stderr)
        return 1

    gen = load_generator()
    BUILD_DIR.mkdir(parents=True, exist_ok=True)

    # Linux / 通用图标：圆角 + 透明背景
    linux_icon = gen.render_seal(LINUX_PNG_SIZE, rounded=True)
    linux_path = BUILD_DIR / "icon.png"
    linux_icon.save(linux_path, format="PNG")
    print(f"[ok] {linux_path.relative_to(ROOT)}  {linux_icon.size[0]}x{linux_icon.size[1]}  {linux_path.stat().st_size} B")

    # Windows .ico：以 256x256 为基准，由 Pillow 生成各档尺寸。
    # 使用 full-bleed（rounded=False）—— Windows 任务栏与资源管理器会给图标加自己的
    # 圆角/阴影，自带透明圆角反而会出现一圈黑边。
    ico_base = gen.render_seal(256, rounded=False)
    ico_path = BUILD_DIR / "icon.ico"
    ico_base.save(ico_path, format="ICO", sizes=ICO_SIZES)
    print(f"[ok] {ico_path.relative_to(ROOT)}  sizes={[s[0] for s in ICO_SIZES]}  {ico_path.stat().st_size} B")

    # 回读校验：确认 ICO 里真的包含 256 这一档（electron-builder 对 Windows 图标有此要求）
    with Image.open(ico_path) as probe:
        available = sorted({size[0] for size in getattr(probe, "ico", None).sizes()}) if getattr(probe, "ico", None) else []
    if 256 not in available:
        print(f"[警告] icon.ico 中未找到 256x256 尺寸（实际：{available}）", file=sys.stderr)
        return 1
    print(f"[ok] icon.ico 内含尺寸：{available}")

    print()
    print("提示：macOS 的 icon.icns 未生成（Pillow 不支持 ICNS）。")
    print("      如需出 macOS 包，请在 macOS 上执行：")
    print("        mkdir -p icon.iconset && sips -z 512 512 icon.png --out icon.iconset/icon_512x512.png")
    print("        iconutil -c icns icon.iconset -o desktop/build/icon.icns")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
