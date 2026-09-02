<script setup lang="ts">
/** 商家小程序根组件仅承载全局设计 Token。 */
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
