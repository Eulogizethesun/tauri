# ohos-theme-forwarding Specification

## Purpose

OHOS 启动期主题保真:系统只在配置**变更**时回调 `onConfigurationUpdate`,冷启动暗色模式下 `theme()` 首查恒返回 Light。本 spec 要求在模块初始化链尾把设备当前配置(尤其 colorMode)经既有回调链主动灌入一次,使 `theme()` 首次查询即返回系统真值。实现经 `resourceManager.getConfigurationSync()`(本地 SDK20 无 `Context.getConfiguration()` 公开 API,设计期 d.ts 核查)。

## ADDED Requirements

### Requirement: Initial device configuration SHALL be injected at module init
At ability startup, after the first module initialization completes, the bridge SHALL inject the device's current configuration (built from `resourceManager.getConfigurationSync()` and completed with neutral defaults for fields the resource-manager configuration does not carry) through the existing `onConfigurationUpdate` forwarding chain — once, before any window queries the theme.

#### Scenario: Dark-mode cold start observes the true colorMode
- **WHEN** the device is in dark mode and the app cold-starts
- **THEN** the injected configuration carries the dark colorMode value
- **AND** the injected line is observable in the device log before window creation

#### Scenario: Injection reuses the existing chain
- **WHEN** the initial configuration is injected
- **THEN** it enters through the same `onConfigurationUpdate` entry the system uses for changes (no new NAPI surface)
- **AND** the Rust-side configuration state and the config-changed dispatch behave as for a system-initiated update

#### Scenario: Injection happens at most once per startup
- **WHEN** the module loop initializes multiple modules
- **THEN** the initial injection is performed only for the first module

#### Scenario: theme() first query returns the system truth
- **WHEN** `theme()` is called shortly after startup with no system configuration change having occurred
- **THEN** it returns the device's actual colorMode (dark mode yields Dark, not the legacy Light default)

#### Scenario: Injection failure does not break startup
- **WHEN** `getConfigurationSync()` or the injection path throws
- **THEN** the failure is caught and logged without aborting the ability startup chain
