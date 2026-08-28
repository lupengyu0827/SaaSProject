<!-- 藏品分类页：提供珠宝、腕表与箱包三个一级浏览入口。 -->
<script setup lang="ts">
const collections = [
  { name: '高级珠宝', caption: 'FINE JEWELLERY', image: '/static/images/mock/diamond-ring.jpg' },
  { name: '典藏腕表', caption: 'VINTAGE WATCHES', image: '/static/images/mock/vintage-watch.jpg' },
  { name: '经典箱包', caption: 'ICONIC BAGS', image: '/static/images/mock/black-handbag.jpg' },
];

/** 返回首页并由首页呈现当前 mock 商品集合。 */
function handleOpenCollection(): void {
  void uni.switchTab({ url: '/pages/index/index' });
}
</script>

<template>
  <view class="page">
    <view class="page-header">
      <text class="header-kicker">THE COLLECTION</text>
      <text class="header-title">分类鉴赏</text>
      <text class="header-copy">按藏品类型进入我们的当期私人甄选。</text>
    </view>
    <view class="collection-list">
      <view
        v-for="(collection, index) in collections"
        :key="collection.name"
        class="collection-card"
        @click="handleOpenCollection"
      >
        <image class="collection-image" :src="collection.image" mode="aspectFill" />
        <view class="collection-content">
          <text class="collection-index">0{{ index + 1 }}</text>
          <view>
            <text class="collection-caption">{{ collection.caption }}</text>
            <text class="collection-name">{{ collection.name }}</text>
          </view>
          <text class="collection-arrow">→</text>
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
@use '../../styles/tokens.scss' as *;
.page {
  min-height: 100vh;
  padding-bottom: 48rpx;
  background: #f4f1eb;
}
.page-header {
  padding: calc(env(safe-area-inset-top) + 96rpx) 32rpx 48rpx;
  background: $bg-dark-base;
}
.header-kicker,
.header-title,
.header-copy,
.collection-caption,
.collection-name {
  display: block;
}
.header-kicker,
.collection-caption,
.collection-index {
  color: #b9854d;
  font-family: $font-mono;
  font-size: 16rpx;
  letter-spacing: 2rpx;
}
.header-title {
  margin-top: 12rpx;
  color: #f2e6cf;
  font-family: $font-display;
  font-size: 46rpx;
}
.header-copy {
  margin-top: 12rpx;
  color: #9da2aa;
  font-size: 21rpx;
}
.collection-list {
  padding: 24rpx;
}
.collection-card {
  margin-bottom: 24rpx;
  overflow: hidden;
  border-radius: 8rpx;
  background: $bg-surface;
}
.collection-image {
  display: block;
  width: 100%;
  height: 420rpx;
}
.collection-content {
  display: grid;
  grid-template-columns: 60rpx 1fr 40rpx;
  align-items: center;
  gap: 16rpx;
  padding: 24rpx;
}
.collection-name {
  margin-top: 6rpx;
  color: #171b22;
  font-family: $font-display;
  font-size: 30rpx;
}
.collection-arrow {
  color: #7f4b20;
  font-size: 28rpx;
}
</style>
