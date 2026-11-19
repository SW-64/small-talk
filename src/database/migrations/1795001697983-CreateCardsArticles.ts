import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCardsArticles1795001697983 implements MigrationInterface {
  name = 'CreateCardsArticles1795001697983';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "articles" ("id" BIGSERIAL NOT NULL, "url" text NOT NULL, "title" text NOT NULL, "description" text NOT NULL, "publisher" text NOT NULL, "published_at" TIMESTAMP WITH TIME ZONE NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_0a6e2c450d83e0b6052c2793334" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_articles_url" ON "articles" ("url") `,
    );
    await queryRunner.query(
      `CREATE TABLE "card_articles" ("card_id" bigint NOT NULL, "article_id" bigint NOT NULL, "source_no" smallint NOT NULL, CONSTRAINT "chk_card_articles_source_no" CHECK ("source_no" >= 1), CONSTRAINT "PK_19d079b265b10cb4fe3f920ee9a" PRIMARY KEY ("card_id", "article_id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_card_articles_article_id" ON "card_articles" ("article_id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_card_articles_card_source_no" ON "card_articles" ("card_id", "source_no") `,
    );
    await queryRunner.query(
      `CREATE TABLE "cards" ("id" BIGSERIAL NOT NULL, "card_date" date NOT NULL, "category" text NOT NULL, "issue_rank" smallint NOT NULL, "title" text NOT NULL, "summary" jsonb, "smalltalk" jsonb, "status" text NOT NULL, "fail_reason" text, "model" text NOT NULL, "article_count" integer NOT NULL, "publisher_count" integer NOT NULL, "window_start" TIMESTAMP WITH TIME ZONE NOT NULL, "window_end" TIMESTAMP WITH TIME ZONE NOT NULL, "regenerate_count" integer NOT NULL DEFAULT '0', "generated_at" TIMESTAMP WITH TIME ZONE NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "chk_cards_window" CHECK ("window_start" < "window_end"), CONSTRAINT "chk_cards_ok_has_content" CHECK ("status" <> 'ok' OR ("summary" IS NOT NULL AND "smalltalk" IS NOT NULL)), CONSTRAINT "chk_cards_status" CHECK ("status" IN ('ok', 'failed')), CONSTRAINT "chk_cards_category" CHECK ("category" IN ('economy', 'tech', 'culture', 'society', 'environment')), CONSTRAINT "PK_5f3269634705fdff4a9935860fc" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_cards_date_category_rank" ON "cards" ("card_date", "category", "issue_rank") `,
    );
    await queryRunner.query(
      `ALTER TABLE "card_articles" ADD CONSTRAINT "FK_cd9bf1f9c422c0c57d5938ea0e3" FOREIGN KEY ("card_id") REFERENCES "cards"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "card_articles" ADD CONSTRAINT "FK_6cffd8ba809ebd915382addf46f" FOREIGN KEY ("article_id") REFERENCES "articles"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "card_articles" DROP CONSTRAINT "FK_6cffd8ba809ebd915382addf46f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "card_articles" DROP CONSTRAINT "FK_cd9bf1f9c422c0c57d5938ea0e3"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."uq_cards_date_category_rank"`,
    );
    await queryRunner.query(`DROP TABLE "cards"`);
    await queryRunner.query(
      `DROP INDEX "public"."uq_card_articles_card_source_no"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_card_articles_article_id"`,
    );
    await queryRunner.query(`DROP TABLE "card_articles"`);
    await queryRunner.query(`DROP INDEX "public"."uq_articles_url"`);
    await queryRunner.query(`DROP TABLE "articles"`);
  }
}
