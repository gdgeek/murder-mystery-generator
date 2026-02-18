/**
 * 迁移服务：将旧版 Script 转换为 PlayableStructure
 * 需求: 6.3, 6.4
 */
import {
  Script,
  PlayableStructure,
  Prologue,
  Act,
  Finale,
  ActGuide,
  PrologueGuide,
  FinaleGuide,
  PlayableDMHandbook,
  PlayablePlayerHandbook,
  PlayerPrologueContent,
  PlayerActContent,
  PlayerFinaleContent,
  PlayableClueDistributionInstruction,
  CharacterIntro,
  FinaleEnding,
  ActVote,
  ActVoteOption,
  ActDiscussion,
  ClueDistributionEntry,
  BranchDecisionPoint,
} from '@gdgeek/murder-mystery-shared';

export class MigrationService {
  /**
   * 检查 Script 是否已有 PlayableStructure
   */
  hasPlayableStructure(script: Script): boolean {
    return !!script.playableStructure;
  }

  /**
   * 将旧版 Script 转换为 PlayableStructure，不修改原始 Script 数据。
   * 映射规则参见设计文档"迁移映射规则"部分。
   */
  migrateToPlayable(script: Script): PlayableStructure {
    const dm = script.dmHandbook;
    const totalRounds = dm.roundGuides.length || 1;

    const prologue = this.buildPrologue(dm);
    const cluesByRound = this.groupCluesByRound(dm.clueDistribution, totalRounds);
    const branchByRound = this.groupBranchesByRound(dm.branchDecisionPoints, totalRounds);

    const acts: Act[] = [];
    const actGuides: ActGuide[] = [];

    for (let i = 0; i < totalRounds; i++) {
      const rg = dm.roundGuides[i];
      const roundClues = cluesByRound.get(i) ?? [];
      const roundBranches = branchByRound.get(i) ?? [];

      acts.push(this.buildAct(i, rg, roundClues, roundBranches));
      actGuides.push(this.buildActGuide(i, rg, roundClues, roundBranches));
    }

    const finale = this.buildFinale(dm);
    const prologueGuide = this.buildPrologueGuide(dm);
    const finaleGuide = this.buildFinaleGuide(dm);

    const dmHandbook: PlayableDMHandbook = {
      prologueGuide,
      actGuides,
      finaleGuide,
    };

    const playerHandbooks = this.buildPlayerHandbooks(script, totalRounds);

    return { prologue, acts, finale, dmHandbook, playerHandbooks };
  }

  // ─── Private helpers ───

  private buildPrologue(dm: Script['dmHandbook']): Prologue {
    return {
      backgroundNarrative: dm.overview || '',
      worldSetting: dm.overview || '',
      characterIntros: dm.characters.map(
        (c): CharacterIntro => ({
          characterId: c.characterId,
          characterName: c.characterName,
          publicDescription: c.description,
        }),
      ),
    };
  }

  /**
   * Group clue distribution entries by round index.
   * Normalises both 0-based and 1-based roundIndex values into a
   * 0-based map keyed by act index (0 … totalRounds-1).
   *
   * Detection: if any entry has roundIndex >= totalRounds, the data
   * is 1-based and all indices are shifted down by 1.
   */
  private groupCluesByRound(
    entries: ClueDistributionEntry[],
    totalRounds: number,
  ): Map<number, ClueDistributionEntry[]> {
    const isOneBased = entries.some((e) => e.roundIndex >= totalRounds);
    const map = new Map<number, ClueDistributionEntry[]>();
    for (const entry of entries) {
      const idx = isOneBased ? entry.roundIndex - 1 : entry.roundIndex;
      if (!map.has(idx)) map.set(idx, []);
      map.get(idx)!.push(entry);
    }
    return map;
  }

  /**
   * Group branch decision points by round index (same normalisation logic).
   */
  private groupBranchesByRound(
    points: BranchDecisionPoint[],
    totalRounds: number,
  ): Map<number, BranchDecisionPoint[]> {
    const isOneBased = points.some((p) => p.roundIndex >= totalRounds);
    const map = new Map<number, BranchDecisionPoint[]>();
    for (const bp of points) {
      const idx = isOneBased ? bp.roundIndex - 1 : bp.roundIndex;
      if (!map.has(idx)) map.set(idx, []);
      map.get(idx)!.push(bp);
    }
    return map;
  }

  private buildAct(
    index: number,
    rg: Script['dmHandbook']['roundGuides'][number] | undefined,
    roundClues: ClueDistributionEntry[],
    roundBranches: BranchDecisionPoint[],
  ): Act {
    const clueIds = roundClues.map((c) => c.clueId);

    const vote: ActVote =
      roundBranches.length > 0
        ? {
            question: roundBranches[0].voteQuestion,
            options: roundBranches[0].options.map(
              (o): ActVoteOption => ({
                id: o.optionId,
                text: o.text,
                impact: o.outcome,
              }),
            ),
          }
        : { question: '', options: [] };

    const discussion: ActDiscussion = {
      topics: rg ? rg.keyEvents : [],
      guidingQuestions: [],
      suggestedMinutes: 10,
    };

    return {
      actIndex: index + 1,
      title: `第${index + 1}幕`,
      narrative: rg ? rg.objectives : '',
      objectives: rg ? rg.keyEvents : [],
      clueIds,
      discussion,
      vote,
    };
  }

  private buildActGuide(
    index: number,
    rg: Script['dmHandbook']['roundGuides'][number] | undefined,
    roundClues: ClueDistributionEntry[],
    roundBranches: BranchDecisionPoint[],
  ): ActGuide {
    const clueInstructions: PlayableClueDistributionInstruction[] = roundClues.map((c) => ({
      clueId: c.clueId,
      targetCharacterId: c.targetCharacterId,
      condition: c.condition,
    }));

    const voteQuestion =
      roundBranches.length > 0 ? roundBranches[0].voteQuestion : '';

    return {
      actIndex: index + 1,
      readAloudText: rg ? rg.objectives : '',
      keyEventHints: rg ? rg.keyEvents : [],
      clueDistributionInstructions: clueInstructions,
      discussionGuidance: '',
      voteHostingNotes: voteQuestion ? `主持投票：${voteQuestion}` : '',
      dmPrivateNotes: rg ? rg.dmNotes : '',
    };
  }

  private buildFinale(dm: Script['dmHandbook']): Finale {
    const finalVote: ActVote = { question: '请投票选出凶手', options: [] };

    const endings: FinaleEnding[] = dm.endings.map((e) => ({
      endingId: e.endingId,
      name: e.name,
      triggerCondition: e.triggerConditions,
      narrative: e.narrative,
      playerEndingSummaries: e.playerEndingSummaries ?? [],
    }));

    return {
      finalVote,
      truthReveal: dm.truthReveal || '',
      endings,
    };
  }

  private buildPrologueGuide(dm: Script['dmHandbook']): PrologueGuide {
    return {
      openingScript: dm.overview || '',
      characterAssignmentNotes: dm.characters
        .map((c) => `${c.characterName}: ${c.role}`)
        .join('\n'),
      rulesIntroduction: '',
    };
  }

  private buildFinaleGuide(dm: Script['dmHandbook']): FinaleGuide {
    const parts = [
      dm.judgingRules.winConditions,
      dm.judgingRules.scoringCriteria,
    ].filter(Boolean);

    return {
      finalVoteHostingFlow: '组织最终投票，统计结果',
      truthRevealScript: dm.truthReveal || '',
      endingJudgmentNotes: parts.join('\n'),
    };
  }

  private buildPlayerHandbooks(
    script: Script,
    totalRounds: number,
  ): PlayablePlayerHandbook[] {
    return script.playerHandbooks.map((ph) => {
      const prologueContent: PlayerPrologueContent = {
        characterId: ph.characterId,
        backgroundStory: ph.backgroundStory,
        relationships: ph.relationships,
        initialKnowledge: ph.knownClues,
      };

      const actContents: PlayerActContent[] = [];
      for (let i = 0; i < totalRounds; i++) {
        const ra = ph.roundActions[i];
        actContents.push({
          actIndex: i + 1,
          characterId: ph.characterId,
          personalNarrative: ra ? ra.instructions : '',
          objectives: [ph.primaryGoal, ...ph.secondaryGoals],
          clueHints: ra ? ra.hints : [],
          discussionSuggestions: [],
          secretInfo: ph.secrets[i] ?? '',
        });
      }

      const finaleContent: PlayerFinaleContent = {
        characterId: ph.characterId,
        closingStatementGuide: `作为${ph.characterName}，做最终陈述`,
        votingSuggestion: '',
      };

      return {
        characterId: ph.characterId,
        characterName: ph.characterName,
        prologueContent,
        actContents,
        finaleContent,
      };
    });
  }
}
