import React, { useEffect, useRef } from 'react';
import Chart from 'chart.js/auto';
import 'chartjs-scale-timestack';

const formatScore = (score) => score > 0 ? `+${score}` : String(score);

export default function VoteHistoryChart({ data }) {
    const canvas_ref = useRef(null);

    useEffect(() => {
        if (!data.length) return;
        const styles = getComputedStyle(document.documentElement);
        const accent = () => styles.getPropertyValue('--w-accent').trim();
        const text = () => styles.getPropertyValue('--w-fg-3').trim();
        const grid = () => styles.getPropertyValue('--w-line').trim();
        const chart = new Chart(canvas_ref.current, {
            type: 'line',
            data: {
                datasets: [{
                    data: data.map(item => ({ x: Date.parse(item.time), y: item.score })),
                    borderColor: accent,
                    backgroundColor: accent,
                    pointHoverBackgroundColor: accent,
                    borderWidth: 3,
                    tension: 0,
                    fill: false,
                    pointRadius: data.length === 1 ? 3 : 0,
                    pointHoverRadius: 4,
                }],
            },
            options: {
                maintainAspectRatio: false,
                animation: false,
                interaction: { mode: 'nearest', intersect: false },
                plugins: {
                    legend: { display: false },
                    tooltip: { callbacks: { label: context => `分数：${formatScore(context.parsed.y)}` } },
                },
                scales: {
                    x: {
                        type: 'timestack',
                        timestack: { density: 0.25, max_density: 0.5, datetime: { locale: 'zh-CN' }, format_style: { hour12: false } },
                        ticks: { color: text },
                        grid: { color: grid },
                    },
                    y: {
                        beginAtZero: true,
                        ticks: { precision: 0, callback: formatScore, color: text },
                        grid: { color: grid },
                    },
                },
            },
        });
        // Canvas 在主题切换后需要重绘才能应用新配色。
        const observer = new MutationObserver(() => chart.update('none'));
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
        return () => {
            observer.disconnect();
            chart.destroy();
        };
    }, [data]);

    if (!data.length) return <div className="flex h-full items-center justify-center text-sm text-fg-3">暂无投票历史</div>;
    return <canvas ref={canvas_ref} role="img" aria-label={`投票历史，共 ${data.length} 条记录，最新分数 ${formatScore(data[data.length - 1].score)}`} />;
}
