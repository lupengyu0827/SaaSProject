<!-- 我的页面：展示消费者身份入口与常用服务。 -->
<script setup lang="ts">
const services = [
  { title: '我的订单', caption: '查看交易与物流进度' },
  { title: '收藏清单', caption: '保存感兴趣的私人藏品' },
  { title: '鉴定服务', caption: '了解平台鉴定与品控流程' },
  { title: '专属客服', caption: '咨询藏品细节与交付服务' },
];
</script>

<template>
  <view class="page">
    <view class="profile-header">
      <text class="header-kicker">PRIVATE CLIENT</text>
      <text class="header-title">我的藏品空间</text>
      <view class="member-card">
        <view class="member-mark">L</view>
        <view class="member-copy">
          <text class="member-title">访客会员</text>
          <text class="member-caption">登录后同步订单与收藏记录</text>
        </view>
        <text class="member-arrow">→</text>
      </view>
    </view>
    <view class="service-list">
      <view v-for="(service, index) in services" :key="service.title" class="service-row">
        <text class="service-index">0{{ index + 1 }}</text>
        <view class="service-copy">
          <text class="service-title">{{ service.title }}</text>
          <text class="service-caption">{{ service.caption }}</text>
        </view>
        <text class="service-arrow">→</text>
      </view>
    </view>
    <text class="footer-note">L'ATELIER · PRIVATE COLLECTION</text>
  </view>
</template>

<style scoped lang="scss">
@use '../../styles/tokens.scss' as *;
.page {
  min-height: 100vh;
  padding-bottom: 48rpx;
  background: #f4f1eb;
}
.profile-header {
  padding: calc(env(safe-area-inset-top) + 96rpx) 32rpx 48rpx;
  background: $bg-dark-base;
}
.header-kicker,
.header-title,
.member-title,
.member-caption,
.service-title,
.service-caption,
.footer-note {
  display: block;
}
.header-kicker,
.service-index {
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
.member-card {
  display: flex;
  align-items: center;
  gap: 20rpx;
  margin-top: 36rpx;
  padding: 24rpx;
  border: 1rpx solid rgba(241, 223, 182, 0.2);
  border-radius: 8rpx;
  background: #121720;
}
.member-mark {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 72rpx;
  height: 72rpx;
  border: 1rpx solid #9b642e;
  border-radius: 50%;
  color: #f1dfb6;
  font-family: $font-display;
  font-size: 34rpx;
}
.member-copy,
.service-copy {
  flex: 1;
}
.member-title {
  color: $text-dark-primary;
  font-size: 25rpx;
}
.member-caption {
  margin-top: 6rpx;
  color: #8e929b;
  font-size: 18rpx;
}
.member-arrow {
  color: #d9bf88;
  font-size: 26rpx;
}
.service-list {
  margin: 24rpx;
  padding: 0 24rpx;
  background: $bg-surface;
}
.service-row {
  display: flex;
  align-items: center;
  gap: 20rpx;
  padding: 30rpx 0;
  border-bottom: 1rpx solid #ece6dc;
}
.service-row:last-child {
  border-bottom: 0;
}
.service-title {
  color: #171b22;
  font-size: 25rpx;
}
.service-caption {
  margin-top: 6rpx;
  color: #858078;
  font-size: 18rpx;
}
.service-arrow {
  color: #9b642e;
  font-size: 24rpx;
}
.footer-note {
  margin-top: 64rpx;
  color: #9a958d;
  font-family: $font-mono;
  font-size: 15rpx;
  letter-spacing: 2rpx;
  text-align: center;
}
</style>
