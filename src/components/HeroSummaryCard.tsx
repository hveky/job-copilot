/** 工作台顶部总览卡：只保留产品定位，不展示重复筛选条件与指标。 */
export function HeroSummaryCard() {
  return (
    <section className="rounded border border-border bg-surface px-5 py-4 shadow-card">
      <h1 className="m-0 text-[24px] leading-8 font-bold text-text">
        从岗位筛选到沟通回复，一站式求职作战台
      </h1>
      <p className="mt-2 mb-0 text-body text-text-2">
        围绕当前目标推进投递与沟通，抓取岗位、评估匹配、生成内容包与回复助手统一协同。
      </p>
    </section>
  );
}
