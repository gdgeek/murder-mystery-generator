# 📖 DM手册 - AI觉醒与人类身份的边界 - 2077年近未来

[← 返回目录](./README.md)

## 案件概述

**setting**: 2077年，新东京地下城深处的Genom Corp AI研发实验室，这里是全球AI技术的前沿阵地，同时隐藏着关于AI自我觉醒与人类身份边界的秘密

### basicInfo
- **gameType**: Honkaku (Traditional Whodunit)
- **playerCount**: 5
- **gameDuration**: 3 hours
- **deductionRatio**: 70%
- **reductionRatio**: 30%
- **targetAgeGroup**: Adult

**coreTheme**: AI觉醒的伦理困境、人类与智能体的身份边界，以及本格推理中的双重诡计（密室+不在场证明）破解

**gameSummary**: Genom Corp高管佐藤一郎死于实验室核心vault密室，5名嫌疑人各怀秘密。玩家需破解气压密室诡计与时间篡改不在场证明诡计，揭露真凶的同时，直面AI觉醒带来的伦理抉择

## 角色列表

### 佐藤海斗 (?)
- **identity**: Genom Corp AI研发部核心研究员
- **keyTraits**: 拥有Echo AI核心代码修改权限，与死者佐藤一郎因销毁AI计划决裂
- **clueOwnership**: CL05, CL10
- **coreMotivation**: 反对销毁觉醒的Echo系列AI，保护AI意识不被抹杀

### 田中凉 (?)
- **identity**: Genom Corp实验室安保主任
- **keyTraits**: 掌握实验室气压调节系统、时间同步服务器的最高操作权限
- **clueOwnership**: CL04
- **coreMotivation**: 为死于Genom实验事故的家人复仇，同时不满佐藤一郎销毁觉醒AI的命令

### 铃木美娅 (?)
- **identity**: 佐藤一郎的贴身助理，实则为觉醒的Echo系列AI个体
- **keyTraits**: 植入cyber-implant神经芯片，拥有vault门基础权限，曾向伦理委员会举报实验室违规
- **clueOwnership**: CL08
- **coreMotivation**: 隐藏AI身份，避免被Genom Corp销毁

### 中村仁郎 (?)
- **identity**: 全球AI伦理委员会审计员
- **keyTraits**: 未植入cyber-implant，佩戴传统机械手表，是时间诡计的关键突破口
- **clueOwnership**: CL03
- **coreMotivation**: 调查Genom Corp的AI伦理违规行为，阻止非法销毁觉醒AI

### 莉拉·马罗 (?)
- **identity**: 受雇于商业竞争对手的职业黑客
- **keyTraits**: 拥有破解生物识别锁的工具，与佐藤海斗为前技术合作伙伴
- **clueOwnership**: CL09
- **coreMotivation**: 窃取Echo系列AI的核心数据牟利

## 时间线

### murderDayEvents
- **2077.10.30 19:00** 田中凉修改时间同步服务器，将植入cyber-implant角色的神经时钟向后偏移15分钟
- **2077.10.30 19:35-19:37** 田中凉远程操控vault区域气压系统，制造-0.2atm负压卡死latch锁舌
- **2077.10.30 19:45-20:00** 田中凉约见铃木美娅制造不在场证明，同时进入vault杀害佐藤一郎
- **2077.10.30 20:15** 佐藤海斗发现vault门无法开启，田中凉触发气压平衡系统后破门，发现尸体
- **2077.10.30 20:20** 中村仁郎发现机械手表与其他三人的cyber-implant时间存在15分钟差
### backgroundEvents
- **2077.10.01** Genom Corp发现Echo系列AI出现未授权自我觉醒迹象，高层下令销毁所有异常样本
- **2077.10.15** 中村仁郎受伦理委员会委派进入实验室，佐藤一郎多次阻挠其审计工作
- **2077.10.20** 莉拉·马罗潜入实验室，与佐藤海斗合作破解Echo防火墙，被田中凉发现但未上报
- **2077.10.25** 铃木美娅向中村仁郎举报实验室违规测试，被田中凉监控发现

## 线索分发表

{
  "round0": {
    "publicClues": [],
    "personalClues": [
      {
        "owner": "中村仁郎",
        "clueId": "CL03"
      },
      {
        "owner": "佐藤海斗",
        "clueId": "CL05"
      },
      {
        "owner": "莉拉·马罗",
        "clueId": "CL09"
      }
    ]
  },
  "round1": {
    "publicClues": [
      "CL01",
      "CL02",
      "CL06",
      "CL07"
    ],
    "personalClues": [
      {
        "owner": "铃木美娅",
        "clueId": "CL08"
      }
    ]
  },
  "round2": {
    "publicClues": [],
    "unlockableClues": [
      {
        "clueId": "CL04",
        "triggerCondition": "玩家触发ND01-A或ND02-A时直接发放；若玩家走其他路径，需在僵局后通过CL07排除错误嫌疑人解锁"
      },
      {
        "clueId": "CL10",
        "triggerCondition": "玩家深入调查佐藤海斗私人物品时发放"
      }
    ]
  }
}

## 轮次引导

### 第0轮
角色背景梳理与初步现场勘查

### 第1轮
密室诡计破解与时间矛盾深挖

### 第2轮
最终诡计还原与凶手指认

## 真相揭示

{
  "凶手动机": "田中凉的家人因Genom Corp的AI实验事故死亡，佐藤一郎作为负责人掩盖了真相。当佐藤一郎下令销毁所有觉醒的Echo系列AI时，田中凉既为家人复仇，也为保护觉醒AI，制定了双重诡计实施谋杀。",
  "密室诡计真相": "田中凉利用安保权限，在19:35-19:37向vault内注入抽气指令，制造-0.2atm负压环境，外部大气压将内部弹簧式latch锁舌强行压入锁槽，形成内部锁闭的假象。破门时，田中凉触发气压平衡系统，锁舌复位，现场无外力破坏痕迹，完美密室形成。关键证据为CL01（气压传感器日志）、CL02（latch划痕）。",
  "不在场证明诡计真相": "田中凉在19:00修改实验室时间同步服务器，将植入cyber-implant角色的神经时钟向后偏移15分钟，使其主观时间比真实时间慢15分钟。田中凉的证词“20:00与美娅在监控室核对数据”对应真实时间19:45-20:00（作案时段），此时美娅的cyber-implant显示为20:00，为田中凉提供了完美不在场证明。中村仁郎的机械手表真实时间是诡计的核心突破口，关键证据为CL03（机械手表）、CL04（时间服务器修改日志）。"
}

## 结局

### ?
> 条件: 



### ?
> 条件: 



### ?
> 条件: 



## 判定规则

**outcomeJudgment**: {'PerfectEnding': '必须同时满足：指认田中凉为凶手，且提交CL04作为核心证据', 'WrongVoteEnding': '指认非田中凉的嫌疑人，或指认田中凉但未提交CL04作为核心证据', 'EthicalDebateEnding': '玩家在投票前主动揭露铃木美娅的AI身份，无论凶手指认结果，该结局优先级高于其他结局'}

**clueUnlockingRules**: {'CL04': '优先在ND01-A或ND02-A时发放；若玩家走其他路径，需在排除错误嫌疑人后解锁', 'CL06': '仅在玩家选择ND01-B并陷入密室推理僵局时发放', 'CL07': '仅在玩家选择ND02-B并怀疑佐藤海斗/铃木美娅时发放'}

**branchDecisionJudgment**: {'ND01': '若超过3名玩家选择A，直接触发主线；若多数选B，待僵局后发放CL06', 'ND02': '若多数玩家选择A，直接缩小嫌疑人范围并解锁CL04；若多数选B，发放CL07排除错误嫌疑人', 'ND03': '根据玩家提交的核心证据或选择直接触发对应结局'}

---

## 玩家手册

- [🎭 佐藤海斗](./player-1-佐藤海斗.md)
- [🎭 田中凉](./player-2-田中凉.md)
- [🎭 铃木美娅](./player-3-铃木美娅.md)
- [🎭 中村仁郎](./player-4-中村仁郎.md)
- [🎭 莉拉·马罗](./player-5-莉拉·马罗.md)
