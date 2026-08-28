<script setup lang="ts">
const foundations = [
  { name: 'Vue Router', detail: '页面路由已经接入' },
  { name: 'Pinia', detail: '全局状态容器已经注册' },
  { name: 'Element Plus', detail: '管理端组件库已经接入' },
  { name: 'Tailwind CSS', detail: '设计令牌与原子样式已经接入' },
];
</script>

<template>
  <section aria-labelledby="dashboard-title" class="space-y-6">
    <div>
      <p class="text-sm font-medium text-accent">PROJECT FOUNDATION</p>
      <h1 id="dashboard-title" class="mt-2 font-display text-3xl tracking-wide">
        管理端工程已就绪
      </h1>
      <p class="mt-3 max-w-prose text-sm leading-6 text-secondary">
        当前只搭建工程基础。后续业务页面会按租户、商品、订单和权限模块逐步实现。
      </p>
    </div>

    <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <article
        v-for="item in foundations"
        :key="item.name"
        class="rounded-xl border border-subtle bg-surface p-4 shadow-luxury"
      >
        <h2 class="text-base font-semibold">{{ item.name }}</h2>
        <p class="mt-2 text-sm text-secondary">{{ item.detail }}</p>
      </article>
    </div>
  </section>
</template>
