<script lang="ts" setup>
import { useHumanFriendlyNumber } from '@nuxtseo/design-system/app/composables/formatting'
import { BaselineSeries, ColorType, createChart, LineSeries } from 'lightweight-charts'

const props = defineProps<{
  value?: { time: string, value: number }[]
  value2?: { time: string, value: number }[]
  height?: number | string
}>()

const colorMode = useColorMode()

const chart = ref<HTMLElement | null>(null)
const container = ref<HTMLElement | null>(null)

const tooltipData = ref({
  position: 0,
  ctr: 0,
  time: '',
})

const darkTheme = {
  chart: {
    layout: {
      background: {
        type: ColorType.Solid,
        color: 'transparent',
      },
      lineColor: '#2B2B43',
      textColor: '#D9D9D9',
    },
    watermark: {
      color: 'rgba(0, 0, 0, 0)',
    },
    grid: {
      vertLines: {
        visible: false,
      },
      horzLines: {
        visible: false,
      },
    },
  },
  series: {
    baseLineColor: 'rgba(32, 226, 47, 1)',
    topLineColor: 'rgba(32, 226, 47, 1)',
    topFillColor1: 'rgba(32, 226, 47, 0.56)',
    topFillColor2: 'rgba(32, 226, 47, 0.04)',
    bottomLineColor: 'rgba(32, 226, 47, 1)',
    bottomFillColor1: 'rgba(32, 226, 47, 0.56)',
    bottomFillColor2: 'rgba(32, 226, 47, 0.04)',
  },
  series2: { color: 'rgba(59, 130, 246, 0.5)' },
} as const

const lightTheme = {
  chart: {
    layout: {
      background: {
        type: ColorType.Solid,
        color: 'transparent',
      },
      lineColor: '#2B2B43',
      textColor: '#191919',
    },
    watermark: {
      color: 'rgba(0, 0, 0, 0)',
    },
    grid: {
      vertLines: {
        visible: false,
      },
      horzLines: {
        visible: false,
      },
    },
  },
  series: {
    baseLineColor: 'rgba(16, 185, 129, 0.5)',
    topLineColor: 'rgba(16, 185, 129, 0.5)',
    topFillColor1: 'rgba(16, 185, 129, 0.9)',
    topFillColor2: 'rgba(16, 185, 129, 0.04)',
    bottomLineColor: 'rgba(16, 185, 129, 0.5)',
    bottomFillColor1: 'rgba(16, 185, 129, 0.9)',
    bottomFillColor2: 'rgba(16, 185, 129, 0.04)',
  },
  // this is the ctr from google search console, we want to use a similar blue
  series2: { color: 'rgba(59, 130, 246, 0.4)' },
} as const

const themesData = {
  Dark: darkTheme,
  Light: lightTheme,
} as const

onMounted(() => {
  const _chart = createChart(chart.value!, {
    height: Number(props.height) || 100,
    autoSize: true,
    rightPriceScale: {
      visible: false,
    },
    timeScale: {
      visible: false,
    },
    crosshair: {
      horzLine: {
        visible: false,
      },
      vertLine: {
        visible: false,
      },
    },
  })
  _chart.timeScale().fitContent()

  const areaSeries = _chart.addSeries(BaselineSeries, {
    baseLineColor: 'rgba(0, 137, 123, 0.5)',

    lineWidth: 2,
    priceScaleId: 'right',
    priceFormat: {
      type: 'volume',
    },
    lineType: 2,
  })

  if (props.value && props.value.length)
    areaSeries.setData(props.value)

  const areaSeries2 = _chart.addSeries(LineSeries, {
    color: 'rgba(232, 113, 10, 0.5)',
    lineWidth: 2,
    priceScaleId: 'left',
    priceFormat: {
      type: 'volume',
    },
    lineType: 2,
  })
  if (props.value2 && props.value2.length)
    areaSeries2.setData(props.value2)

  _chart.subscribeCrosshairMove((param) => {
    const _container = container.value!
    if (
      param.point === undefined
      || typeof param.time !== 'string'
      || param.point.x < 0
      || param.point.x > _container.clientWidth
      || param.point.y < 0
      || param.point.y > _container.clientHeight
    ) {
      tooltipData.value = {
        position: 0,
        ctr: 0,
        time: '',
      }
    }
    else {
      // time will be in the same format that we supplied to setData.
      // thus it will be YYYY-MM-DD
      const dateStr = param.time
      // toolTip.style.display = 'block'
      const positionPoint = param.seriesData.get(areaSeries)
      const position = positionPoint && 'value' in positionPoint ? positionPoint.value : 0
      const ctrPoint = param.seriesData.get(areaSeries2)
      const ctr = ctrPoint && 'value' in ctrPoint ? ctrPoint.value : 0

      tooltipData.value = {
        position,
        ctr,
        time: dateStr,
      }
    }
  })

  function syncToTheme(theme: keyof typeof themesData) {
    _chart.applyOptions(themesData[theme].chart)
    areaSeries.applyOptions(themesData[theme].series)
    areaSeries2.applyOptions(themesData[theme].series2)
  }

  syncToTheme(colorMode.value === 'dark' ? 'Dark' : 'Light')
  watch(colorMode, (newVal) => {
    syncToTheme(newVal.value === 'dark' ? 'Dark' : 'Light')
  })
})
</script>

<template>
  <div ref="container" class="w-full h-full">
    <div ref="chart" />
    <div class="tooltip">
      <div v-if="tooltipData.time" class="dark:text-gray-200 text-gray-600 text-xs">
        <div class="dark:text-gray-400 text-gray-500 text-xs ">
          {{ tooltipData.time }}
        </div>
        <div>Position {{ useHumanFriendlyNumber(tooltipData.position) }}</div>
        <div>
          CTR {{ useHumanFriendlyNumber(tooltipData.ctr) }}%
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tooltip {
  text-align: center;
  position: absolute;
  padding: 4px;
  z-index: 20;
  top: 4px;
  left: 50%;
  transform: translateX(-50%);
  pointer-events: none;
}
</style>
