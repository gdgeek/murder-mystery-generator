/**
 * 反馈驱动优化相关类型定义
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5
 */

/** 反馈维度评分 */
export interface DimensionScore {
  dimension: string;
  averageScore: number;
  count: number;
}

/** 汇总反馈 */
export interface AggregatedFeedback {
  scriptId: string;
  totalReviews: number;
  dimensions: DimensionScore[];
  frequentSuggestions: string[];
}

/** 优化摘要 */
export interface OptimizationSummary {
  optimizedDimensions: string[];
  referencedFeedbackCount: number;
  suggestions: string[];
}
