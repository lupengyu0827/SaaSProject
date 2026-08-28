<script setup lang="ts">
import { RouterView } from 'vue-router';
</script>

<template>
  <div class="min-h-screen bg-canvas text-primary">
    <header class="border-b border-subtle bg-surface">
      <div class="mx-auto flex h-16 max-w-screen-2xl items-center justify-between px-6">
        <div>
          <p class="font-display text-lg tracking-wider">SaaS 管理中枢</p>
          <p class="text-xs text-secondary">多租户电商运营工作台</p>
        </div>
        <el-tag effect="plain" type="warning">开发环境</el-tag>
      </div>
    </header>

    <main class="mx-auto max-w-screen-2xl px-6 py-8">
      <RouterView />
    </main>
  </div>
</template>
