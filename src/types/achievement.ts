import { Attributes, GameStateValues } from './game'

export interface Achievement {
  id: string
  name: string
  description: string
  icon: string
  category: 'career' | 'attribute' | 'relationship' | 'endgame' | 'special'
  /** 同组内互斥阶梯（例：80/95 两档、品级 7 个等级、升官次数） */
  group?: string
  /** 组内显示优先级：数字越大越优先显示；未设则视为独立成就 */
  priority?: number
  checkUnlock: (ctx: AchievementContext) => boolean
  unlocked: boolean
  unlockTime?: string
}

export interface AchievementContext {
  attributes: Attributes
  gameState: GameStateValues
  characterRank?: string
  hasEnded?: boolean
  endingType?: string
  eventHistory: string[]
}

export interface AchievementData {
  unlocked: string[]
  unlockTimes: Record<string, string>
}

// 成就定义
export const ALL_ACHIEVEMENTS: Achievement[] = [
  // 仕途成就
  {
    id: 'from_ninth',
    name: '从九起步',
    description: '担任从九品司狱',
    icon: '九',
    category: 'career',
    group: 'rank',
    priority: 5,
    checkUnlock: (ctx) => ctx.characterRank?.includes('从九品') === true,
    unlocked: false
  },
  {
    id: 'first_official',
    name: '初入仕途',
    description: '完成第一次做官',
    icon: '仕',
    category: 'career',
    group: 'rank',
    priority: 10,
    checkUnlock: (ctx) => ctx.characterRank !== undefined && ctx.characterRank !== '',
    unlocked: false
  },
  {
    id: 'ninth_rank',
    name: '正九品官',
    description: '担任正九品主簿',
    icon: '品',
    category: 'career',
    group: 'rank',
    priority: 15,
    checkUnlock: (ctx) => ctx.characterRank?.includes('正九品') === true,
    unlocked: false
  },
  {
    id: 'eighth_rank',
    name: '八品县丞',
    description: '担任从八品县丞',
    icon: '丞',
    category: 'career',
    group: 'rank',
    priority: 25,
    checkUnlock: (ctx) => ctx.characterRank?.includes('从八品') === true,
    unlocked: false
  },
  {
    id: 'seventh_rank',
    name: '七品通判',
    description: '担任从七品通判',
    icon: '判',
    category: 'career',
    group: 'rank',
    priority: 30,
    checkUnlock: (ctx) => ctx.characterRank?.includes('从七品') === true,
    unlocked: false
  },
  {
    id: 'county_magistrate',
    name: '七品知县',
    description: '担任正七品知县',
    icon: '县',
    category: 'career',
    group: 'rank',
    priority: 35,
    checkUnlock: (ctx) => ctx.characterRank?.includes('知县') === true,
    unlocked: false
  },
  {
    id: 'sixth_rank',
    name: '六品同知',
    description: '担任正六品同知',
    icon: '同',
    category: 'career',
    group: 'rank',
    priority: 45,
    checkUnlock: (ctx) => ctx.characterRank?.includes('正六品') === true,
    unlocked: false
  },
  {
    id: 'fifth_rank',
    name: '五品郎中',
    description: '担任正五品郎中',
    icon: '郎',
    category: 'career',
    group: 'rank',
    priority: 55,
    checkUnlock: (ctx) => ctx.characterRank?.includes('正五品') === true,
    unlocked: false
  },
  {
    id: 'prefecture_magistrate',
    name: '四品知府',
    description: '担任正四品知府',
    icon: '府',
    category: 'career',
    group: 'rank',
    priority: 65,
    checkUnlock: (ctx) => ctx.characterRank?.includes('知府') === true,
    unlocked: false
  },
  {
    id: 'third_rank',
    name: '三品大理',
    description: '担任正三品大理寺卿',
    icon: '理',
    category: 'career',
    group: 'rank',
    priority: 75,
    checkUnlock: (ctx) => ctx.characterRank?.includes('大理寺卿') === true,
    unlocked: false
  },
  {
    id: 'second_rank',
    name: '二品尚书',
    description: '担任正二品尚书',
    icon: '尚',
    category: 'career',
    group: 'rank',
    priority: 85,
    checkUnlock: (ctx) => ctx.characterRank?.includes('尚书') === true,
    unlocked: false
  },
  {
    id: 'minister',
    name: '一品大员',
    description: '担任正一品大员',
    icon: '员',
    category: 'career',
    group: 'rank',
    priority: 95,
    checkUnlock: (ctx) => ctx.characterRank?.includes('太师') === true || ctx.characterRank?.includes('正一品') === true,
    unlocked: false
  },
  {
    id: 'never_demoted',
    name: '一路高升',
    description: '从未被贬官',
    icon: '升',
    category: 'career',
    checkUnlock: (ctx) => ctx.gameState.turn >= 30 && (ctx as any).demotionCount === 0,
    unlocked: false
  },
  {
    id: 'five_promotions',
    name: '五连升',
    description: '单次游戏内升官5次以上',
    icon: '升',
    category: 'career',
    group: 'promotion',
    priority: 50,
    checkUnlock: (ctx) => (ctx as any).promotionCount >= 5,
    unlocked: false
  },
  {
    id: 'ten_promotions',
    name: '十连升',
    description: '单次游戏内升官10次以上',
    icon: '迁',
    category: 'career',
    group: 'promotion',
    priority: 100,
    checkUnlock: (ctx) => (ctx as any).promotionCount >= 10,
    unlocked: false
  },
  {
    id: 'promotion_master',
    name: '升官达人',
    description: '单次游戏内升官15次以上',
    icon: '达',
    category: 'career',
    group: 'promotion',
    priority: 150,
    checkUnlock: (ctx) => (ctx as any).promotionCount >= 15,
    unlocked: false
  },
  {
    id: 'fallen_official',
    name: '三起三落',
    description: '贬官次数达到3次以上',
    icon: '落',
    category: 'career',
    checkUnlock: (ctx) => (ctx as any).demotionCount >= 3,
    unlocked: false
  },
  // 属性成就
  {
    id: 'wealthy',
    name: '富甲一方',
    description: '财帛属性达到 80 以上',
    icon: '富',
    category: 'attribute',
    group: 'wealth',
    priority: 80,
    checkUnlock: (ctx) => ctx.attributes.财帛 >= 80,
    unlocked: false
  },
  {
    id: 'rich',
    name: '家财万贯',
    description: '财帛属性达到 95 以上',
    icon: '财',
    category: 'attribute',
    group: 'wealth',
    priority: 100,
    checkUnlock: (ctx) => ctx.attributes.财帛 >= 95,
    unlocked: false
  },
  {
    id: 'scholar',
    name: '文采斐然',
    description: '文韬属性达到 80 以上',
    icon: '文',
    category: 'attribute',
    group: 'intellect',
    priority: 80,
    checkUnlock: (ctx) => ctx.attributes.文韬 >= 80,
    unlocked: false
  },
  {
    id: 'genius_writer',
    name: '才高八斗',
    description: '文韬属性达到 95 以上',
    icon: '才',
    category: 'attribute',
    group: 'intellect',
    priority: 100,
    checkUnlock: (ctx) => ctx.attributes.文韬 >= 95,
    unlocked: false
  },
  {
    id: 'administrator',
    name: '治世能臣',
    description: '理政属性达到 80 以上',
    icon: '治',
    category: 'attribute',
    group: 'admin',
    priority: 80,
    checkUnlock: (ctx) => ctx.attributes.理政 >= 80,
    unlocked: false
  },
  {
    id: 'master_admin',
    name: '治国奇才',
    description: '理政属性达到 95 以上',
    icon: '国',
    category: 'attribute',
    group: 'admin',
    priority: 100,
    checkUnlock: (ctx) => ctx.attributes.理政 >= 95,
    unlocked: false
  },
  {
    id: 'military_genius',
    name: '军事奇才',
    description: '武略属性达到 80 以上',
    icon: '军',
    category: 'attribute',
    group: 'military',
    priority: 80,
    checkUnlock: (ctx) => ctx.attributes.武略 >= 80,
    unlocked: false
  },
  {
    id: 'war_god',
    name: '战神转世',
    description: '武略属性达到 95 以上',
    icon: '战',
    category: 'attribute',
    group: 'military',
    priority: 100,
    checkUnlock: (ctx) => ctx.attributes.武略 >= 95,
    unlocked: false
  },
  {
    id: 'emperor_favor',
    name: '圣眷正隆',
    description: '圣眷值达到 80 以上',
    icon: '眷',
    category: 'attribute',
    group: 'emperor',
    priority: 80,
    checkUnlock: (ctx) => ctx.gameState.圣眷 >= 80,
    unlocked: false
  },
  {
    id: 'imperial_favorite',
    name: '帝王心腹',
    description: '圣眷值达到 95 以上',
    icon: '心',
    category: 'attribute',
    group: 'emperor',
    priority: 100,
    checkUnlock: (ctx) => ctx.gameState.圣眷 >= 95,
    unlocked: false
  },
  {
    id: 'popular',
    name: '民望所归',
    description: '民望值达到 80 以上',
    icon: '望',
    category: 'attribute',
    group: 'reputation',
    priority: 80,
    checkUnlock: (ctx) => ctx.gameState.民望 >= 80,
    unlocked: false
  },
  {
    id: 'loved_by_all',
    name: '万民爱戴',
    description: '民望值达到 95 以上',
    icon: '爱',
    category: 'attribute',
    group: 'reputation',
    priority: 100,
    checkUnlock: (ctx) => ctx.gameState.民望 >= 95,
    unlocked: false
  },
  {
    id: 'poor',
    name: '两袖清风',
    description: '财帛属性低于 20',
    icon: '清',
    category: 'attribute',
    group: 'wealth',
    priority: 10,
    checkUnlock: (ctx) => ctx.attributes.财帛 <= 20,
    unlocked: false
  },
  {
    id: 'weak',
    name: '体弱多病',
    description: '体质属性低于 20',
    icon: '病',
    category: 'attribute',
    group: 'body',
    priority: 10,
    checkUnlock: (ctx) => ctx.attributes.体质 <= 20,
    unlocked: false
  },
  {
    id: 'strong_body',
    name: '身强力壮',
    description: '体质属性达到 80 以上',
    icon: '壮',
    category: 'attribute',
    group: 'body',
    priority: 80,
    checkUnlock: (ctx) => ctx.attributes.体质 >= 80,
    unlocked: false
  },
  {
    id: 'iron_body',
    name: '钢筋铁骨',
    description: '体质属性达到 95 以上',
    icon: '骨',
    category: 'attribute',
    group: 'body',
    priority: 100,
    checkUnlock: (ctx) => ctx.attributes.体质 >= 95,
    unlocked: false
  },
  // 关系成就
  {
    id: 'clean_image',
    name: '清风亮节',
    description: '清议值达到 80 以上',
    icon: '风',
    category: 'relationship',
    group: 'qingyi',
    priority: 80,
    checkUnlock: (ctx) => ctx.gameState.清议 >= 80,
    unlocked: false
  },
  {
    id: 'scholar_elite',
    name: '士林领袖',
    description: '清议值达到 95 以上',
    icon: '林',
    category: 'relationship',
    group: 'qingyi',
    priority: 100,
    checkUnlock: (ctx) => ctx.gameState.清议 >= 95,
    unlocked: false
  },
  {
    id: 'eunuch_alliance',
    name: '宦海同游',
    description: '宦官关系达到 80 以上',
    icon: '宦',
    category: 'relationship',
    group: 'eunuch',
    priority: 80,
    checkUnlock: (ctx) => ctx.gameState.中官 >= 80,
    unlocked: false
  },
  {
    id: 'eunuch_boss',
    name: '阉党之首',
    description: '宦官关系达到 95 以上',
    icon: '阉',
    category: 'relationship',
    group: 'eunuch',
    priority: 100,
    checkUnlock: (ctx) => ctx.gameState.中官 >= 95,
    unlocked: false
  },
  {
    id: 'gentry_support',
    name: '士绅拥戴',
    description: '士绅关系达到 80 以上',
    icon: '绅',
    category: 'relationship',
    group: 'gentry',
    priority: 80,
    checkUnlock: (ctx) => ctx.gameState.士绅 >= 80,
    unlocked: false
  },
  {
    id: 'gentry_alliance',
    name: '士绅领袖',
    description: '士绅关系达到 95 以上',
    icon: '绅',
    category: 'relationship',
    group: 'gentry',
    priority: 100,
    checkUnlock: (ctx) => ctx.gameState.士绅 >= 95,
    unlocked: false
  },
  // 结局成就
  {
    id: 'completed_game',
    name: '仕途圆满',
    description: '完成一局游戏（到达任意结局）',
    icon: '圆',
    category: 'endgame',
    group: 'endtype',
    priority: 5,
    checkUnlock: (ctx) => ctx.hasEnded === true,
    unlocked: false
  },
  {
    id: 'good_ending',
    name: '善始善终',
    description: '达成正面结局',
    icon: '善',
    category: 'endgame',
    group: 'endtype',
    priority: 80,
    checkUnlock: (ctx) => ctx.endingType === 'good' || ctx.endingType === 'legendary',
    unlocked: false
  },
  {
    id: 'legendary_ending',
    name: '传奇结局',
    description: '达成传奇结局',
    icon: '奇',
    category: 'endgame',
    group: 'endtype',
    priority: 100,
    checkUnlock: (ctx) => ctx.endingType === 'legendary',
    unlocked: false
  },
  {
    id: 'bad_ending',
    name: '宦海浮沉',
    description: '达成负面结局',
    icon: '浮',
    category: 'endgame',
    group: 'endtype',
    priority: 30,
    checkUnlock: (ctx) => ctx.endingType === 'bad' || ctx.endingType === 'tragic',
    unlocked: false
  },
  {
    id: 'tragic_ending',
    name: '悲剧收场',
    description: '达成悲剧结局',
    icon: '悲',
    category: 'endgame',
    group: 'endtype',
    priority: 60,
    checkUnlock: (ctx) => ctx.endingType === 'tragic',
    unlocked: false
  },
  {
    id: 'normal_ending',
    name: '平淡一生',
    description: '达成普通结局',
    icon: '淡',
    category: 'endgame',
    group: 'endtype',
    priority: 50,
    checkUnlock: (ctx) => ctx.endingType === 'normal',
    unlocked: false
  },
  // ════════════════════════════════════════════════
  // 具体结局解锁的专属成就
  // ════════════════════════════════════════════════
  {
    id: 'ending_famous_minister_done',
    name: '名臣垂范',
    description: '达成"名臣垂范"结局',
    icon: '范',
    category: 'endgame',
    checkUnlock: (ctx) => ctx.endingType === 'legendary' && ctx.eventHistory.includes('ending_famous_minister'),
    unlocked: false
  },
  {
    id: 'ending_zhongxing_success_done',
    name: '再造乾坤',
    description: '达成"中兴成功"结局',
    icon: '乾',
    category: 'endgame',
    checkUnlock: (ctx) => ctx.eventHistory.includes('ending_zhongxing_success'),
    unlocked: false
  },
  {
    id: 'ending_martyr_nation_done',
    name: '碧血丹心',
    description: '达成"殉国死节"结局',
    icon: '碧',
    category: 'endgame',
    checkUnlock: (ctx) => ctx.eventHistory.includes('ending_martyr_nation'),
    unlocked: false
  },
  {
    id: 'ending_died_battlefield_done',
    name: '马革裹尸',
    description: '达成"战死沙场"结局',
    icon: '革',
    category: 'endgame',
    checkUnlock: (ctx) => ctx.eventHistory.includes('ending_died_battlefield'),
    unlocked: false
  },
  {
    id: 'ending_city_fall_done',
    name: '城破殉城',
    description: '达成"城破殉城"结局',
    icon: '城',
    category: 'endgame',
    checkUnlock: (ctx) => ctx.eventHistory.includes('ending_city_fall'),
    unlocked: false
  },
  {
    id: 'ending_border_general_done',
    name: '威震塞外',
    description: '达成"边关大将"结局',
    icon: '塞',
    category: 'endgame',
    checkUnlock: (ctx) => ctx.eventHistory.includes('ending_border_general'),
    unlocked: false
  },
  {
    id: 'ending_duty_death_done',
    name: '鞠躬尽瘁',
    description: '达成"殉职任上"结局',
    icon: '瘁',
    category: 'endgame',
    checkUnlock: (ctx) => ctx.eventHistory.includes('ending_duty_death'),
    unlocked: false
  },
  {
    id: 'ending_pure_stream_done',
    name: '铁面御史',
    description: '达成"清流骨鲠"结局',
    icon: '御',
    category: 'endgame',
    checkUnlock: (ctx) => ctx.eventHistory.includes('ending_pure_stream'),
    unlocked: false
  },
  {
    id: 'ending_honorable_retirement_done',
    name: '急流勇退',
    description: '达成"致仕善终"结局',
    icon: '退',
    category: 'endgame',
    checkUnlock: (ctx) => ctx.eventHistory.includes('ending_honorable_retirement'),
    unlocked: false
  },
  {
    id: 'ending_ordinary_life_done',
    name: '与世无争',
    description: '达成"平凡终老"结局',
    icon: '世',
    category: 'endgame',
    checkUnlock: (ctx) => ctx.eventHistory.includes('ending_ordinary_life'),
    unlocked: false
  },
  {
    id: 'ending_usurper_throne_done',
    name: '黄袍加身',
    description: '达成"篡位自立"结局',
    icon: '袍',
    category: 'endgame',
    checkUnlock: (ctx) => ctx.eventHistory.includes('ending_usurper_throne'),
    unlocked: false
  },
  {
    id: 'ending_qing_tributary_done',
    name: '忍辱负重',
    description: '达成"忍辱负重"结局',
    icon: '辱',
    category: 'endgame',
    checkUnlock: (ctx) => ctx.eventHistory.includes('ending_qing_tributary'),
    unlocked: false
  },
  {
    id: 'ending_clan_exterminate_done',
    name: '罪有应得',
    description: '达成"抄家灭族"结局',
    icon: '罪',
    category: 'endgame',
    checkUnlock: (ctx) => ctx.eventHistory.includes('ending_clan_exterminate'),
    unlocked: false
  },
  {
    id: 'ending_pirate_king_done',
    name: '纵横四海',
    description: '达成"纵横四海"结局',
    icon: '海',
    category: 'endgame',
    checkUnlock: (ctx) => ctx.eventHistory.includes('ending_pirate_king'),
    unlocked: false
  },
  {
    id: 'ending_bandit_king_done',
    name: '流寇之雄',
    description: '达成"落草为寇"结局',
    icon: '寇',
    category: 'endgame',
    checkUnlock: (ctx) => ctx.eventHistory.includes('ending_bandit_king'),
    unlocked: false
  },
  {
    id: 'ending_debauch_fall_done',
    name: '纵欲而亡',
    description: '达成"纵欲而亡"结局',
    icon: '欲',
    category: 'endgame',
    checkUnlock: (ctx) => ctx.eventHistory.includes('ending_debauch_fall'),
    unlocked: false
  },
  {
    id: 'ending_pimp_lord_done',
    name: '烟花之主',
    description: '达成"烟花之主"结局',
    icon: '花',
    category: 'endgame',
    checkUnlock: (ctx) => ctx.eventHistory.includes('ending_pimp_lord'),
    unlocked: false
  },
  {
    id: 'ending_traitor_done',
    name: '卖国求荣',
    description: '达成"卖国求荣"结局',
    icon: '卖',
    category: 'endgame',
    checkUnlock: (ctx) => ctx.eventHistory.includes('ending_traitor'),
    unlocked: false
  },
  {
    id: 'ending_hermit_taoist_done',
    name: '悠然南山',
    description: '达成"悠然南山"结局',
    icon: '山',
    category: 'endgame',
    checkUnlock: (ctx) => ctx.eventHistory.includes('ending_hermit_taoist'),
    unlocked: false
  },
  {
    id: 'ending_monk_nirvana_done',
    name: '明镜台',
    description: '达成"明镜台"结局',
    icon: '镜',
    category: 'endgame',
    checkUnlock: (ctx) => ctx.eventHistory.includes('ending_monk_nirvana'),
    unlocked: false
  },
  {
    id: 'ending_recluse_scholar_done',
    name: '万世师表',
    description: '达成"万世师表"结局',
    icon: '师',
    category: 'endgame',
    checkUnlock: (ctx) => ctx.eventHistory.includes('ending_recluse_scholar'),
    unlocked: false
  },
  {
    id: 'ending_wealthy_retiree_done',
    name: '金山银山',
    description: '达成"金山银山"结局',
    icon: '金',
    category: 'endgame',
    checkUnlock: (ctx) => ctx.eventHistory.includes('ending_wealthy_retiree'),
    unlocked: false
  },
  {
    id: 'ending_exile_overseas_done',
    name: '天涯海角',
    description: '达成"天涯海角"结局',
    icon: '涯',
    category: 'endgame',
    checkUnlock: (ctx) => ctx.eventHistory.includes('ending_exile_overseas'),
    unlocked: false
  },
  {
    id: 'ending_family_man_done',
    name: '枝繁叶茂',
    description: '达成"枝繁叶茂"结局',
    icon: '枝',
    category: 'endgame',
    checkUnlock: (ctx) => ctx.eventHistory.includes('ending_family_man'),
    unlocked: false
  },
  {
    id: 'ending_medical_saint_done',
    name: '杏林春暖',
    description: '达成"杏林春暖"结局',
    icon: '杏',
    category: 'endgame',
    checkUnlock: (ctx) => ctx.eventHistory.includes('ending_medical_saint'),
    unlocked: false
  },
  {
    id: 'ending_unknown_fate_done',
    name: '不知所踪',
    description: '达成"不知所踪"结局',
    icon: '踪',
    category: 'endgame',
    checkUnlock: (ctx) => ctx.eventHistory.includes('ending_unknown_fate'),
    unlocked: false
  },
  {
    id: 'ending_zhaoyu_prison_done',
    name: '六月飞雪',
    description: '达成"诏狱冤死"结局',
    icon: '雪',
    category: 'endgame',
    checkUnlock: (ctx) => ctx.eventHistory.includes('ending_zhaoyu_prison'),
    unlocked: false
  },
  {
    id: 'ending_southern_ming_done',
    name: '南渡孤臣',
    description: '达成"南渡续祚"结局',
    icon: '渡',
    category: 'endgame',
    checkUnlock: (ctx) => ctx.eventHistory.includes('ending_southern_ming'),
    unlocked: false
  },
  {
    id: 'ending_jiashen_nationfall_done',
    name: '天崩地坼',
    description: '达成"天崩地坼"结局',
    icon: '崩',
    category: 'endgame',
    checkUnlock: (ctx) => ctx.eventHistory.includes('ending_jiashen_nationfall'),
    unlocked: false
  },
  {
    id: 'ending_collection_5',
    name: '结局收藏家',
    description: '解锁 5 种不同的结局',
    icon: '藏',
    category: 'endgame',
    group: 'collection',
    priority: 5,
    checkUnlock: (ctx) => ctx.eventHistory.filter(e => e.startsWith('ending_') && !e.includes('_done')).length >= 5,
    unlocked: false
  },
  {
    id: 'ending_collection_15',
    name: '阅历大明',
    description: '解锁 15 种不同的结局',
    icon: '历',
    category: 'endgame',
    group: 'collection',
    priority: 15,
    checkUnlock: (ctx) => ctx.eventHistory.filter(e => e.startsWith('ending_') && !e.includes('_done')).length >= 15,
    unlocked: false
  },
  {
    id: 'ending_collection_30',
    name: '百味人生',
    description: '解锁 30 种不同的结局',
    icon: '味',
    category: 'endgame',
    group: 'collection',
    priority: 30,
    checkUnlock: (ctx) => ctx.eventHistory.filter(e => e.startsWith('ending_') && !e.includes('_done')).length >= 30,
    unlocked: false
  },
  // 特殊成就
  {
    id: 'persistent',
    name: '持之以恒',
    description: '游玩超过 50 个回合',
    icon: '恒',
    category: 'special',
    group: 'longevity',
    priority: 50,
    checkUnlock: (ctx) => ctx.gameState.turn >= 50,
    unlocked: false
  },
  {
    id: 'long_live',
    name: '为官一甲子',
    description: '游玩超过 100 个回合',
    icon: '甲',
    category: 'special',
    group: 'longevity',
    priority: 100,
    checkUnlock: (ctx) => ctx.gameState.turn >= 100,
    unlocked: false
  },
  {
    id: 'survivor',
    name: '乱世生存',
    description: '撑到崇祯 17 年',
    icon: '生',
    category: 'special',
    checkUnlock: (ctx) => ctx.gameState.currentYear >= 1644,
    unlocked: false
  },
  {
    id: 'pre_1644',
    name: '明亡之前',
    description: '在崇祯 17 年前结束游戏',
    icon: '明',
    category: 'special',
    group: 'endyear',
    priority: 50,
    checkUnlock: (ctx) => ctx.hasEnded === true && ctx.gameState.currentYear < 1644,
    unlocked: false
  },
  {
    id: 'year_1644',
    name: '王朝末日',
    description: '在崇祯 17 年结束游戏',
    icon: '末',
    category: 'special',
    group: 'endyear',
    priority: 75,
    checkUnlock: (ctx) => ctx.hasEnded === true && ctx.gameState.currentYear === 1644,
    unlocked: false
  },
  {
    id: 'year_1645',
    name: '见证沦陷',
    description: '在崇祯 17 年之后继续游戏',
    icon: '陷',
    category: 'special',
    group: 'endyear',
    priority: 100,
    checkUnlock: (ctx) => ctx.gameState.currentYear > 1644,
    unlocked: false
  },
  {
    id: 'decade_official',
    name: '十年为官',
    description: '担任官职超过10年',
    icon: '十',
    category: 'special',
    checkUnlock: (ctx) => ctx.gameState.currentYear - 1628 >= 10,
    unlocked: false
  },
  {
    id: 'half_decade',
    name: '半载仕途',
    description: '担任官职不超过5年',
    icon: '半',
    category: 'special',
    checkUnlock: (ctx) => ctx.hasEnded === true && ctx.gameState.currentYear - 1628 <= 5,
    unlocked: false
  },
  {
    id: 'collector',
    name: '成就收集者',
    description: '解锁 30 个以上成就',
    icon: '集',
    category: 'special',
    group: 'collector',
    priority: 30,
    checkUnlock: () => false, // 这个需要特殊处理
    unlocked: false
  },
  {
    id: 'master_collector',
    name: '成就大师',
    description: '解锁 60 个以上成就',
    icon: '师',
    category: 'special',
    group: 'collector',
    priority: 60,
    checkUnlock: () => false, // 这个需要特殊处理
    unlocked: false
  },
  {
    id: 'ultimate_master',
    name: '至尊大师',
    description: '解锁 80 个以上成就',
    icon: '尊',
    category: 'special',
    group: 'collector',
    priority: 80,
    checkUnlock: () => false, // 这个需要特殊处理
    unlocked: false
  },
  {
    id: 'legendary_master',
    name: '传奇大师',
    description: '解锁全部成就',
    icon: '传',
    category: 'special',
    group: 'collector',
    priority: 100,
    checkUnlock: () => false, // 这个需要特殊处理
    unlocked: false
  },
  {
    id: 'balanced',
    name: '全面发展',
    description: '所有属性均达到 60 以上',
    icon: '全',
    category: 'special',
    group: 'balance',
    priority: 50,
    checkUnlock: (ctx) => ctx.attributes.财帛 >= 60 && ctx.attributes.文韬 >= 60 && ctx.attributes.理政 >= 60 && ctx.attributes.武略 >= 60 && ctx.attributes.体质 >= 60,
    unlocked: false
  },
  {
    id: 'perfect_balance',
    name: '全能之才',
    description: '所有属性均达到 80 以上',
    icon: '才',
    category: 'special',
    group: 'balance',
    priority: 100,
    checkUnlock: (ctx) => ctx.attributes.财帛 >= 80 && ctx.attributes.文韬 >= 80 && ctx.attributes.理政 >= 80 && ctx.attributes.武略 >= 80 && ctx.attributes.体质 >= 80,
    unlocked: false
  },
  {
    id: 'noble_climb',
    name: '世家崛起',
    description: '以缙绅或诗文清望出身达到太师',
    icon: '崛',
    category: 'special',
    checkUnlock: (ctx) => 
      ((ctx as any).origin === '缙绅' || (ctx as any).origin === '诗文清望') && 
      (ctx.characterRank?.includes('太师') === true || ctx.characterRank?.includes('正一品') === true),
    unlocked: false
  },
  // ============ 组合成就 ============
  {
    id: 'rich_popular',
    name: '富而有德',
    description: '财帛和民望均达到 80 以上',
    icon: '德',
    category: 'special',
    checkUnlock: (ctx) => ctx.attributes.财帛 >= 80 && ctx.gameState.民望 >= 80,
    unlocked: false
  },
  {
    id: 'scholar_official',
    name: '文武双全',
    description: '文韬和武略均达到 80 以上',
    icon: '双',
    category: 'special',
    checkUnlock: (ctx) => ctx.attributes.文韬 >= 80 && ctx.attributes.武略 >= 80,
    unlocked: false
  },
  {
    id: 'emperor_people',
    name: '君民兼得',
    description: '圣眷和民望均达到 80 以上',
    icon: '兼',
    category: 'special',
    checkUnlock: (ctx) => ctx.gameState.圣眷 >= 80 && ctx.gameState.民望 >= 80,
    unlocked: false
  },
  {
    id: 'three_high',
    name: '三高官员',
    description: '圣眷、清议、民望均达到 70 以上',
    icon: '高',
    category: 'special',
    checkUnlock: (ctx) => 
      ctx.gameState.圣眷 >= 70 && 
      ctx.gameState.清议 >= 70 && 
      ctx.gameState.民望 >= 70,
    unlocked: false
  },
  {
    id: 'corrupt_official',
    name: '贪官污吏',
    description: '财帛达到 90 且清议低于 30',
    icon: '贪',
    category: 'special',
    checkUnlock: (ctx) => ctx.attributes.财帛 >= 90 && ctx.gameState.清议 < 30,
    unlocked: false
  },
  {
    id: 'loyal_minister',
    name: '忠臣良将',
    description: '圣眷达到 80 且清议达到 80',
    icon: '忠',
    category: 'special',
    checkUnlock: (ctx) => ctx.gameState.圣眷 >= 80 && ctx.gameState.清议 >= 80,
    unlocked: false
  },
  {
    id: 'neutral_official',
    name: '中立之道',
    description: '清议和中官均在 40-60 之间',
    icon: '中',
    category: 'special',
    checkUnlock: (ctx) => 
      ctx.gameState.清议 >= 40 && ctx.gameState.清议 <= 60 &&
      ctx.gameState.中官 >= 40 && ctx.gameState.中官 <= 60,
    unlocked: false
  },
  // ============ 趣味成就 ============
  {
    id: 'lucky',
    name: '时来运转',
    description: '连续 10 回合未触发负面事件',
    icon: '运',
    category: 'special',
    checkUnlock: (ctx) => (ctx as any).luckyStreak >= 10,
    unlocked: false
  },
  {
    id: 'unlucky',
    name: '屋漏偏逢雨',
    description: '连续 5 回合遭遇负面事件',
    icon: '漏',
    category: 'special',
    checkUnlock: (ctx) => (ctx as any).unluckyStreak >= 5,
    unlocked: false
  },
  {
    id: 'first_choice',
    name: '果断抉择',
    description: '在 100 个事件中都选择了第一个选项',
    icon: '决',
    category: 'special',
    checkUnlock: (ctx) => (ctx as any).firstChoiceCount >= 100,
    unlocked: false
  },
  {
    id: 'random_player',
    name: '随心所欲',
    description: '随机选择选项 50 次以上',
    icon: '随',
    category: 'special',
    checkUnlock: (ctx) => (ctx as any).randomChoiceCount >= 50,
    unlocked: false
  },
  {
    id: 'careful_player',
    name: '谨慎行事',
    description: '使用回退功能 10 次以上',
    icon: '慎',
    category: 'special',
    checkUnlock: (ctx) => (ctx as any).undoCount >= 10,
    unlocked: false
  },
  {
    id: 'saver',
    name: '习惯性存档',
    description: '存档次数达到 30 次以上',
    icon: '存',
    category: 'special',
    checkUnlock: (ctx) => (ctx as any).saveCount >= 30,
    unlocked: false
  }
]

// 成就数据（每个存档独立一份，不再用 localStorage 共享）
// 改用 module-level 内存变量：玩家读档时 GameScreen 读 SaveData 恢复，新游戏时清空
let currentAchievementData: AchievementData = { unlocked: [], unlockTimes: {} }

/** 获取当前内存中的成就数据（不再读 localStorage） */
export function getCurrentAchievementData(): AchievementData {
  return currentAchievementData
}

/** 设置当前内存中的成就数据（读档/新游戏时调用） */
export function setAchievementData(data: AchievementData): void {
  currentAchievementData = data
}

// 读取成就数据（从内存）
export function loadAchievements(): AchievementData {
  return currentAchievementData
}

// 保存成就数据（写到内存，不写 localStorage）
export function saveAchievements(data: AchievementData): void {
  currentAchievementData = data
}

// 获取解锁的成就列表（包含完整信息）
// 同时按 group 合并：同组内只保留 priority 最高的成就
export function getUnlockedAchievements(): Achievement[] {
  const data = loadAchievements()
  const all: Achievement[] = ALL_ACHIEVEMENTS.map(a => ({
    ...a,
    unlocked: data.unlocked.includes(a.id),
    unlockTime: data.unlockTimes[a.id]
  }))

  const unlocked = all.filter(a => a.unlocked)

  // 按 group 分桶：每桶只保留 priority 最高的
  const groupMap = new Map<string, Achievement>()
  const standalone: Achievement[] = []

  for (const a of unlocked) {
    if (a.group) {
      const cur = groupMap.get(a.group)
      if (!cur || (a.priority ?? 0) > (cur.priority ?? 0)) {
        groupMap.set(a.group, a)
      }
    } else {
      standalone.push(a)
    }
  }

  // 合并 + 按 priority 降序、名称稳定排序
  return [...groupMap.values(), ...standalone].sort((a, b) => {
    const pa = a.priority ?? 0
    const pb = b.priority ?? 0
    if (pb !== pa) return pb - pa
    return a.name.localeCompare(b.name)
  })
}

// 获取所有成就状态
export function getAllAchievements(): Achievement[] {
  const data = loadAchievements()
  return ALL_ACHIEVEMENTS.map(a => ({
    ...a,
    unlocked: data.unlocked.includes(a.id),
    unlockTime: data.unlockTimes[a.id]
  }))
}

// 解锁成就
export function unlockAchievement(id: string): Achievement | null {
  const achievement = ALL_ACHIEVEMENTS.find(a => a.id === id)
  if (!achievement) return null

  const data = loadAchievements()
  if (data.unlocked.includes(id)) return null

  data.unlocked.push(id)
  data.unlockTimes[id] = new Date().toISOString()
  saveAchievements(data)
  
  // 检查"成就收集者"
  if (data.unlocked.length >= 30 && !data.unlocked.includes('collector')) {
    const collector = ALL_ACHIEVEMENTS.find(a => a.id === 'collector')
    if (collector) {
      data.unlocked.push('collector')
      data.unlockTimes['collector'] = new Date().toISOString()
      saveAchievements(data)
    }
  }
  
  // 检查"成就大师"
  if (data.unlocked.length >= 60 && !data.unlocked.includes('master_collector')) {
    const master = ALL_ACHIEVEMENTS.find(a => a.id === 'master_collector')
    if (master) {
      data.unlocked.push('master_collector')
      data.unlockTimes['master_collector'] = new Date().toISOString()
      saveAchievements(data)
    }
  }
  
  // 检查"至尊大师"
  if (data.unlocked.length >= 80 && !data.unlocked.includes('ultimate_master')) {
    const ultimate = ALL_ACHIEVEMENTS.find(a => a.id === 'ultimate_master')
    if (ultimate) {
      data.unlocked.push('ultimate_master')
      data.unlockTimes['ultimate_master'] = new Date().toISOString()
      saveAchievements(data)
    }
  }
  
  // 检查"传奇大师"
  if (data.unlocked.length >= ALL_ACHIEVEMENTS.length && !data.unlocked.includes('legendary_master')) {
    const legendary = ALL_ACHIEVEMENTS.find(a => a.id === 'legendary_master')
    if (legendary) {
      data.unlocked.push('legendary_master')
      data.unlockTimes['legendary_master'] = new Date().toISOString()
      saveAchievements(data)
    }
  }

  return { ...achievement, unlocked: true, unlockTime: data.unlockTimes[id] }
}

// 检查并解锁应该解锁的成就
export function checkAndUnlockAchievements(ctx: AchievementContext): Achievement[] {
  const data = loadAchievements()
  const achievements = getAllAchievements()
  const newlyUnlocked: Achievement[] = []

  for (const achievement of achievements) {
    if (!data.unlocked.includes(achievement.id) && achievement.checkUnlock(ctx)) {
      const unlocked = unlockAchievement(achievement.id)
      if (unlocked) {
        newlyUnlocked.push(unlocked)
      }
    }
  }

  return newlyUnlocked
}
