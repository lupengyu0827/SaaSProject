<script setup lang="ts">
/** 应用根组件仅承载全局样式，页面生命周期由各入口页面管理。 */
</script>

<style lang="scss">
@use './styles/tokens.scss' as *;

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
