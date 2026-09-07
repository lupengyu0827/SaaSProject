<script setup lang="ts">
/** 商家小程序根组件仅承载全局设计 Token。 */
</script>

<style lang="scss">
/* 统一用 @import：App 级会被注入 uni.scss（含 uview 主题变量），
   若此处用 @use 会触发 "@use rules must be written before any other rules"。 */
@import './styles/tokens.scss';
@import './styles/themes.scss';
@import 'uview-plus/index.scss';

page {
  min-height: 100%;
  color: $text-primary;
  background: $bg-base;
  font-family: 'PingFang SC', system-ui, sans-serif;
}

view,
text,
button {
  box-sizing: border-box;
}
</style>
