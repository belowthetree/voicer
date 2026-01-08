#!/bin/bash

# Android APK 打包脚本
# 用于构建和打包 Tauri + Vue.js 项目的 Android APK

set -e  # 遇到错误时退出脚本

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查命令是否存在
check_command() {
    if ! command -v $1 &> /dev/null; then
        log_error "命令 '$1' 未找到，请先安装"
        return 1
    fi
    log_info "找到命令: $1"
    return 0
}

# 检查环境变量
check_env() {
    log_info "检查环境变量..."
    
    # 检查 ANDROID_HOME
    if [ -z "$ANDROID_HOME" ]; then
        log_error "ANDROID_HOME 环境变量未设置"
        log_info "请设置 ANDROID_HOME 环境变量，例如:"
        log_info "  export ANDROID_HOME=\$HOME/Library/Android/sdk"
        return 1
    fi
    log_info "ANDROID_HOME: $ANDROID_HOME"
    
    # 检查 JAVA_HOME
    if [ -z "$JAVA_HOME" ]; then
        # 尝试自动查找 Java
        if [ -d "/usr/libexec/java_home" ]; then
            JAVA_HOME=$(/usr/libexec/java_home 2>/dev/null || echo "")
        fi
        if [ -z "$JAVA_HOME" ]; then
            log_warning "JAVA_HOME 环境变量未设置，尝试自动查找..."
        fi
    fi
    if [ -n "$JAVA_HOME" ]; then
        log_info "JAVA_HOME: $JAVA_HOME"
        export JAVA_HOME
        export PATH="$JAVA_HOME/bin:$PATH"
    fi
    
    return 0
}

# 检查依赖
check_dependencies() {
    log_info "检查依赖..."
    
    # 检查 Java
    check_command java || {
        log_error "请安装 Java (OpenJDK 17 或更高版本)"
        log_info "可以使用: brew install openjdk@17"
        return 1
    }
    
    # 检查 npm
    check_command npm || {
        log_error "请安装 Node.js 和 npm"
        return 1
    }
    
    # 检查 Rust
    check_command rustc || {
        log_error "请安装 Rust"
        log_info "可以使用: curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh"
        return 1
    }
    
    # 检查 Cargo
    check_command cargo || {
        log_error "请安装 Cargo (Rust 包管理器)"
        return 1
    }
    
    # 检查 Android SDK 工具
    if [ ! -f "$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager" ]; then
        log_warning "Android SDK Manager 未找到，可能需要安装 Android Command Line Tools"
    fi
    
    # 检查 adb
    check_command adb || {
        log_warning "adb 未找到，但这不是构建所必需的"
    }
    
    # 检查 keytool
    check_command keytool || {
        log_error "keytool 未找到 (Java 开发工具包的一部分)"
        return 1
    }
    
    log_success "所有依赖检查通过"
    return 0
}

# 安装 Android SDK 组件
install_android_sdk() {
    log_info "安装 Android SDK 组件..."
    
    local sdkmanager="$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager"
    
    if [ ! -f "$sdkmanager" ]; then
        log_error "sdkmanager 未找到，请先安装 Android Command Line Tools"
        return 1
    fi
    
    # 接受所有许可证
    yes | $sdkmanager --licenses > /dev/null 2>&1 || true
    
    # 安装必要的组件
    local components=(
        "platform-tools"
        "platforms;android-36"
        "build-tools;35.0.0"
        "ndk;29.0.13846066"
        "cmdline-tools;latest"
    )
    
    for component in "${components[@]}"; do
        log_info "安装: $component"
        $sdkmanager "$component" --sdk_root="$ANDROID_HOME" > /dev/null 2>&1 || {
            log_warning "安装 $component 失败，尝试继续..."
        }
    done
    
    log_success "Android SDK 组件安装完成"
    return 0
}

# 安装 Rust Android 目标
install_rust_targets() {
    log_info "安装 Rust Android 目标..."
    
    local targets=(
        "aarch64-linux-android"
        "armv7-linux-androideabi"
        "i686-linux-android"
        "x86_64-linux-android"
    )
    
    for target in "${targets[@]}"; do
        log_info "安装目标: $target"
        rustup target add $target > /dev/null 2>&1 || {
            log_error "安装目标 $target 失败"
            return 1
        }
    done
    
    log_success "Rust Android 目标安装完成"
    return 0
}

# 配置项目
configure_project() {
    log_info "配置项目..."
    
    # 检查 Cargo.toml 中的 reqwest 配置
    local cargo_toml="src-tauri/Cargo.toml"
    if grep -q 'reqwest = { version = "0.11", features = \["json", "rustls-tls"\], default-features = false }' "$cargo_toml"; then
        log_info "Cargo.toml 配置正确"
    else
        log_warning "Cargo.toml 可能需要更新 reqwest 配置以避免 OpenSSL 问题"
        log_info "建议配置: reqwest = { version = \"0.11\", features = [\"json\", \"rustls-tls\"], default-features = false }"
    fi
    
    # 检查 package.json 中的 tauri 脚本
    local package_json="package.json"
    if grep -q '"tauri": "tauri"' "$package_json"; then
        log_info "package.json 配置正确"
    else
        log_warning "package.json 中缺少 tauri 脚本"
        log_info "建议添加: \"tauri\": \"tauri\" 到 scripts 部分"
    fi
    
    # 安装 npm 依赖
    log_info "安装 npm 依赖..."
    npm install > /dev/null 2>&1 || {
        log_error "npm 依赖安装失败"
        return 1
    }
    
    log_success "项目配置完成"
    return 0
}

# 构建项目
build_project() {
    log_info "构建项目..."
    
    # 构建前端
    log_info "构建前端..."
    npm run build > /dev/null 2>&1 || {
        log_error "前端构建失败"
        return 1
    }
    
    # 构建 Android APK
    log_info "构建 Android APK..."
    npx tauri android build > build.log 2>&1 || {
        log_error "Android APK 构建失败，查看 build.log 获取详细信息"
        return 1
    }
    
    log_success "项目构建完成"
    return 0
}

# 签名 APK
sign_apk() {
    log_info "签名 APK..."
    
    local apk_dir="src-tauri/gen/android/app/build/outputs/apk/universal/release"
    local unsigned_apk="$apk_dir/app-universal-release-unsigned.apk"
    local keystore="$apk_dir/voicer-release-key.keystore"
    local signed_apk="$apk_dir/voicer-signed.apk"
    local aligned_apk="$apk_dir/voicer-aligned.apk"
    local final_apk="$apk_dir/voicer-final.apk"
    
    # 检查未签名的 APK
    if [ ! -f "$unsigned_apk" ]; then
        log_error "未找到未签名的 APK: $unsigned_apk"
        return 1
    fi
    
    # 创建签名密钥库（如果不存在）
    if [ ! -f "$keystore" ]; then
        log_info "创建签名密钥库..."
        keytool -genkey -v -keystore "$keystore" -alias voicer -keyalg RSA -keysize 2048 \
            -validity 10000 -storepass voicer123 -keypass voicer123 \
            -dname "CN=Voicer, OU=Development, O=Voicer, L=Shanghai, ST=Shanghai, C=CN" > /dev/null 2>&1 || {
            log_error "创建密钥库失败"
            return 1
        }
    fi
    
    # 使用 jarsigner 签名（v1 签名）
    log_info "使用 jarsigner 签名 APK..."
    jarsigner -verbose -sigalg SHA1withRSA -digestalg SHA1 \
        -keystore "$keystore" -storepass voicer123 -keypass voicer123 \
        "$unsigned_apk" voicer > /dev/null 2>&1 || {
        log_error "jarsigner 签名失败"
        return 1
    }
    
    mv "$unsigned_apk" "$signed_apk"
    
    # 对齐 APK
    log_info "对齐 APK..."
    local zipalign="$ANDROID_HOME/build-tools/35.0.0/zipalign"
    if [ ! -f "$zipalign" ]; then
        log_warning "zipalign 未找到，跳过对齐步骤"
        cp "$signed_apk" "$aligned_apk"
    else
        $zipalign -v -p 4 "$signed_apk" "$aligned_apk" > /dev/null 2>&1 || {
            log_error "APK 对齐失败"
            return 1
        }
    fi
    
    # 使用 apksigner 重新签名（添加 v2/v3 签名）
    log_info "使用 apksigner 重新签名（添加 v2/v3 签名）..."
    local apksigner="$ANDROID_HOME/build-tools/35.0.0/apksigner"
    if [ ! -f "$apksigner" ]; then
        log_warning "apksigner 未找到，使用现有签名"
        cp "$aligned_apk" "$final_apk"
    else
        $apksigner sign --ks "$keystore" --ks-pass pass:voicer123 \
            --key-pass pass:voicer123 --out "$final_apk" "$aligned_apk" > /dev/null 2>&1 || {
            log_error "apksigner 签名失败"
            return 1
        }
        
        # 验证签名
        log_info "验证 APK 签名..."
        $apksigner verify --verbose "$final_apk" > /dev/null 2>&1 || {
            log_error "APK 签名验证失败"
            return 1
        }
    fi
    
    log_success "APK 签名完成: $final_apk"
    return 0
}

# 显示构建结果
show_results() {
    log_info "显示构建结果..."
    
    local apk_dir="src-tauri/gen/android/app/build/outputs/apk/universal/release"
    local final_apk="$apk_dir/voicer-final.apk"
    
    if [ -f "$final_apk" ]; then
        echo ""
        echo "================================================"
        echo "            Android APK 构建完成！"
        echo "================================================"
        echo ""
        echo "APK 文件: $final_apk"
        echo ""
        
        # 显示 APK 信息
        if command -v $ANDROID_HOME/build-tools/35.0.0/aapt &> /dev/null; then
            echo "APK 信息:"
            $ANDROID_HOME/build-tools/35.0.0/aapt dump badging "$final_apk" | grep -E "package:|sdkVersion:|targetSdkVersion:|application-label:" | head -5
        fi
        
        echo ""
        echo "文件大小: $(du -h "$final_apk" | cut -f1)"
        echo ""
        echo "安装命令:"
        echo "  adb install $final_apk"
        echo ""
        echo "================================================"
    else
        log_error "未找到最终的 APK 文件"
        return 1
    fi
    
    return 0
}

# 清理临时文件
cleanup() {
    log_info "清理临时文件..."
    
    # 保留构建日志和最终 APK，删除中间文件
    rm -f build.log 2>/dev/null || true
    
    log_success "清理完成"
}

# 主函数
main() {
    echo ""
    echo "================================================"
    echo "      Tauri Android APK 打包脚本"
    echo "================================================"
    echo ""
    
    # 检查环境
    check_env || exit 1
    
    # 检查依赖
    check_dependencies || exit 1
    
    # 安装 Android SDK 组件
    install_android_sdk || {
        log_warning "Android SDK 组件安装可能不完整，尝试继续..."
    }
    
    # 安装 Rust Android 目标
    install_rust_targets || exit 1
    
    # 配置项目
    configure_project || exit 1
    
    # 构建项目
    build_project || exit 1
    
    # 签名 APK
    sign_apk || exit 1
    
    # 显示结果
    show_results || exit 1
    
    # 清理
    cleanup
    
    echo ""
    log_success "Android APK 打包流程完成！"
    echo ""
}

# 运行主函数
main "$@"
