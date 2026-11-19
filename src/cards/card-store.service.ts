import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, In } from 'typeorm';
import { Article } from '../database/entities/article.entity';
import { CardArticle } from '../database/entities/card-article.entity';
import {
  Card,
  CARD_CATEGORIES,
  CardCategory,
} from '../database/entities/card.entity';
import type {
  CardSource,
  IssueCardsResult,
} from '../news/issue-cards/issue-cards.types';
import { toKstDate } from './kst-date';

export interface SaveCardsResult {
  cardDate: string;
  window: { start: string; end: string };
  replacedCards: number; // 같은 날짜·카테고리에 있던 기존 카드 (덮어씀)
  savedCards: { ok: number; failed: number };
  articles: { linked: number; distinct: number };
  cardIds: string[];
}

/**
 * issue-cards 실행 결과를 cards / articles / card_articles 에 저장한다.
 * 같은 기준일·카테고리의 기존 카드는 지우고 새로 넣는다 (재실행해도 결과가 겹치지 않게)
 */
@Injectable()
export class CardStoreService {
  private readonly logger = new Logger(CardStoreService.name);

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async save(
    result: IssueCardsResult,
    generatedAt = new Date(),
  ): Promise<SaveCardsResult> {
    const windowStart = new Date(result.window.start);
    const windowEnd = new Date(result.window.end);
    // 수집 기간 끝(당일 06:00 KST)의 날짜가 기준일
    const cardDate = toKstDate(windowEnd);

    const categories = result.categories.filter(({ category }) =>
      (CARD_CATEGORIES as readonly string[]).includes(category),
    );
    const unknown = result.categories
      .map((c) => c.category)
      .filter((c) => !(CARD_CATEGORIES as readonly string[]).includes(c));
    if (unknown.length > 0) {
      this.logger.warn(
        `[저장] 알 수 없는 카테고리 건너뜀: ${unknown.join(', ')}`,
      );
    }

    return this.dataSource.transaction(async (em) => {
      const deleted = await em.delete(Card, {
        cardDate,
        category: In(categories.map((c) => c.category)),
      });

      // 1) 기사: URL 기준으로 중복 없이 upsert
      const sourcesByUrl = new Map<string, CardSource>();
      for (const { cards } of categories) {
        for (const card of cards) {
          if (card.status !== 'ok') continue;
          for (const s of card.sources) {
            if (!sourcesByUrl.has(s.url)) sourcesByUrl.set(s.url, s);
          }
        }
      }
      const urls = [...sourcesByUrl.keys()];
      if (urls.length > 0) {
        await em.upsert(
          Article,
          [...sourcesByUrl.values()].map((s) => ({
            url: s.url,
            title: s.title,
            description: s.description,
            publisher: s.publisher,
            publishedAt: new Date(s.publishedAt),
          })),
          ['url'],
        );
      }
      const articleIdByUrl = new Map(
        (urls.length > 0
          ? await em.find(Article, {
              select: { id: true, url: true },
              where: { url: In(urls) },
            })
          : []
        ).map((a) => [a.url, a.id]),
      );

      // 2) 카드 + 3) 카드-기사 연결
      const cardIds: string[] = [];
      let ok = 0;
      let failed = 0;
      let linked = 0;
      for (const { category, cards } of categories) {
        for (const card of cards) {
          const saved = await em.save(
            em.create(Card, {
              cardDate,
              category: category as CardCategory,
              issueRank: card.issueRank,
              title: card.representativeTitle,
              summary: card.status === 'ok' ? card.summary : null,
              smalltalk: card.status === 'ok' ? card.smalltalk : null,
              status: card.status,
              failReason:
                card.status === 'failed'
                  ? `${card.reason}: ${card.error}`
                  : null,
              model: result.model,
              articleCount: card.articleCount,
              publisherCount: card.publisherCount,
              windowStart,
              windowEnd,
              generatedAt,
            }),
          );
          cardIds.push(saved.id);

          if (card.status !== 'ok') {
            failed++;
            continue;
          }
          ok++;
          const links = card.sources.map((s) =>
            em.create(CardArticle, {
              cardId: saved.id,
              articleId: articleIdByUrl.get(s.url)!,
              sourceNo: s.id,
            }),
          );
          // 한 카드 안에 같은 URL 이 두 번 들어오는 경우는 첫 번호만 남긴다
          const unique = links.filter(
            (l, i) => links.findIndex((x) => x.articleId === l.articleId) === i,
          );
          await em.insert(CardArticle, unique);
          linked += unique.length;
        }
      }

      const summary: SaveCardsResult = {
        cardDate,
        window: result.window,
        replacedCards: deleted.affected ?? 0,
        savedCards: { ok, failed },
        articles: { linked, distinct: urls.length },
        cardIds,
      };
      this.logger.log(
        `[저장] ${cardDate} — 카드 성공 ${ok} / 실패 ${failed}, 기사 ${urls.length}건, 기존 카드 ${summary.replacedCards}개 교체`,
      );
      return summary;
    });
  }
}
