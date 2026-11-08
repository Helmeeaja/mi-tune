export const motionTokens = {
  duration: { fast: 0.16, normal: 0.24, slow: 0.32 },
  easing: { smooth: [0.22, 1, 0.36, 1] },
  distance: { small: 5 },
  scale: { press: 0.96, hover: 1.025 }
}

export const springs = {
  snappy: { type: 'spring', stiffness: 360, damping: 30 },
  gentle: { type: 'spring', stiffness: 230, damping: 27 }
}
