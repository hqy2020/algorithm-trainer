import ReactEChartsCore from 'echarts-for-react';
import type { CompareItem } from '../api';

interface Props {
  data: CompareItem[];
}

export function CompletionPieChart({ data }: Props) {
  const option = {
    title: { text: '完成题目数', left: 'center' },
    tooltip: { trigger: 'item' },
    legend: { bottom: 0 },
    series: [{
      type: 'pie',
      radius: ['40%', '65%'],
      data: data.map(d => ({
        name: d.user_name,
        value: d.unique_solved,
        itemStyle: { color: d.user_color },
      })),
      label: { formatter: '{b}: {c}题' },
    }],
  };
  return <ReactEChartsCore option={option} style={{ height: 300 }} />;
}

export function DifficultyBarChart({ data }: Props) {
  const difficulties = ['Easy', 'Medium', 'Hard'];
  const option = {
    title: { text: '按难度平均用时（分钟）', left: 'center' },
    tooltip: { trigger: 'axis' },
    legend: { bottom: 0 },
    xAxis: { type: 'category', data: difficulties },
    yAxis: { type: 'value', name: '分钟' },
    series: data.map(d => ({
      name: d.user_name,
      type: 'bar',
      data: difficulties.map(diff => Math.round((d.by_difficulty[diff]?.avg_time || 0) / 60)),
      itemStyle: { color: d.user_color },
    })),
  };
  return <ReactEChartsCore option={option} style={{ height: 300 }} />;
}

export function PassRateChart({ data }: Props) {
  const option = {
    title: { text: '通过率对比', left: 'center' },
    tooltip: { trigger: 'axis' },
    legend: { bottom: 0 },
    xAxis: { type: 'category', data: data.map(d => d.user_name) },
    yAxis: { type: 'value', name: '%', max: 100 },
    series: [{
      type: 'bar',
      data: data.map(d => ({
        value: d.pass_rate,
        itemStyle: { color: d.user_color },
      })),
      barWidth: 60,
      label: { show: true, position: 'top', formatter: '{c}%' },
    }],
  };
  return <ReactEChartsCore option={option} style={{ height: 300 }} />;
}

export function DifficultyPassChart({ data }: Props) {
  const difficulties = ['Easy', 'Medium', 'Hard'];
  const option = {
    title: { text: '各难度通过数', left: 'center' },
    tooltip: { trigger: 'axis' },
    legend: { bottom: 0 },
    xAxis: { type: 'category', data: difficulties },
    yAxis: { type: 'value', name: '题数' },
    series: data.map(d => ({
      name: d.user_name,
      type: 'bar',
      data: difficulties.map(diff => d.by_difficulty[diff]?.passed || 0),
      itemStyle: { color: d.user_color },
    })),
  };
  return <ReactEChartsCore option={option} style={{ height: 300 }} />;
}
