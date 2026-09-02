<script setup lang="ts">
/** PC 管理后台登录页：通过租户子域、邮箱和密码建立管理员会话。 */
import type { FormInstance, FormRules } from 'element-plus';
import { ElMessage } from 'element-plus';
import { reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { useAuth } from '../../composables/use-auth';

interface LoginForm {
  subdomain: string;
  email: string;
  password: string;
}

const router = useRouter();
const route = useRoute();
const auth = useAuth();
const formRef = ref<FormInstance>();
const submitting = ref(false);
const form = reactive<LoginForm>({ subdomain: 'demo-jewelry', email: 'admin@demo-jewelry.local', password: 'SaasDemo@2026!' });
const rules: FormRules<LoginForm> = {
  subdomain: [{ required: true, message: '请输入租户子域', trigger: 'blur' }],
  email: [
    { required: true, message: '请输入管理员邮箱', trigger: 'blur' },
    { type: 'email', message: '请输入有效的邮箱地址', trigger: 'blur' },
  ],
  password: [{ required: true, min: 8, message: '密码至少 8 位', trigger: 'blur' }],
};

async function onSubmit(): Promise<void> {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) return;
  submitting.value = true;
  try {
    await auth.login(form);
    ElMessage.success('登录成功');
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/';
    await router.replace(redirect);
  } catch (error: unknown) {
    ElMessage.error(error instanceof Error ? error.message : '登录失败，请稍后重试');
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <main class="flex min-h-screen bg-[var(--pc-bg-page)]">
    <section class="hidden w-[42%] flex-col justify-between bg-[var(--pc-sidebar-bg)] p-12 text-white lg:flex">
      <div>
        <div class="mb-16 flex items-center gap-3">
          <div class="flex h-10 w-10 items-center justify-center rounded bg-[var(--pc-primary)] text-lg font-semibold">
            S
          </div>
          <div>
            <p class="text-base font-medium">多租户电商 SaaS</p>
            <p class="text-xs text-[var(--pc-sidebar-muted)]">Merchant Operations Center</p>
          </div>
        </div>
        <p class="mb-4 text-sm text-[var(--pc-sidebar-muted)]">统一经营管理平台</p>
        <h1 class="max-w-md text-3xl font-medium leading-normal">
          让商品、订单与租户经营<br />回到清晰高效的工作流
        </h1>
      </div>
      <p class="text-xs text-[var(--pc-sidebar-muted)]">安全隔离 · 权限可控 · 全程审计</p>
    </section>

    <section class="flex flex-1 items-center justify-center p-6">
      <div
        class="w-full max-w-[420px] rounded-md border border-[var(--pc-border)] bg-[var(--pc-bg-surface)] p-10 shadow-[var(--pc-shadow-card)]">
        <header class="mb-8">
          <h2 class="mb-2 text-xl font-medium text-[var(--pc-text-primary)]">登录商家后台</h2>
          <p class="text-sm text-[var(--pc-text-secondary)]">请输入租户与管理员账号信息</p>
        </header>

        <el-form ref="formRef" :model="form" :rules="rules" label-position="top" @submit.prevent="onSubmit">
          <el-form-item label="租户子域" prop="subdomain">
            <el-input v-model="form.subdomain" autocomplete="organization" placeholder="例如：demo-shop" size="large" />
          </el-form-item>
          <el-form-item label="管理员邮箱" prop="email">
            <el-input v-model="form.email" autocomplete="username" placeholder="name@example.com" size="large" />
          </el-form-item>
          <el-form-item label="密码" prop="password">
            <el-input
              v-model="form.password"
              autocomplete="current-password"
              placeholder="请输入密码"
              show-password
              size="large"
              type="password"
              @keyup.enter="onSubmit"
            />
          </el-form-item>
          <el-button
            class="mt-2 w-full whitespace-nowrap"
            :loading="submitting"
            native-type="submit"
            size="large"
            type="primary"
            >登录</el-button
          >
        </el-form>
        <p class="mt-6 text-center text-xs text-[var(--pc-text-muted)]">
          登录即表示你同意平台的安全与数据使用规范
        </p>
      </div>
    </section>
  </main>
</template>
