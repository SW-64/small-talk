import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitSchema1795076936452 implements MigrationInterface {
  name = 'InitSchema1795076936452';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "daily_runs" ("run_date" date NOT NULL, "status" text NOT NULL, "window_start" TIMESTAMP WITH TIME ZONE NOT NULL, "window_end" TIMESTAMP WITH TIME ZONE NOT NULL, "published_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "chk_daily_runs_window" CHECK ("window_start" < "window_end"), CONSTRAINT "chk_daily_runs_status" CHECK ("status" IN ('collecting', 'extracted', 'reviewing', 'generated', 'published')), CONSTRAINT "PK_350e47404f4a7e664efcf44407c" PRIMARY KEY ("run_date"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "issues" ("id" BIGSERIAL NOT NULL, "run_date" date NOT NULL, "category" text NOT NULL, "representative_title" text NOT NULL, "search_terms" jsonb NOT NULL, "search_score" double precision, "category_rank" smallint, "overall_rank" smallint, "headline" text, "review_status" text NOT NULL DEFAULT 'pending', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "chk_issues_overall_rank" CHECK ("overall_rank" IS NULL OR "overall_rank" BETWEEN 1 AND 15), CONSTRAINT "chk_issues_category_rank" CHECK ("category_rank" IS NULL OR "category_rank" BETWEEN 1 AND 4), CONSTRAINT "chk_issues_review_status" CHECK ("review_status" IN ('pending', 'approved', 'rejected')), CONSTRAINT "chk_issues_category" CHECK ("category" IN ('economy', 'tech', 'culture', 'society', 'environment')), CONSTRAINT "PK_9d8ecbbeff46229c700f0449257" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_issues_run_overall_rank" ON "issues" ("run_date", "overall_rank") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_issues_run_category_rank" ON "issues" ("run_date", "category", "category_rank") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_issues_run_date" ON "issues" ("run_date") `,
    );
    await queryRunner.query(
      `CREATE TABLE "articles" ("id" BIGSERIAL NOT NULL, "url" text NOT NULL, "title" text NOT NULL, "description" text, "publisher" text NOT NULL, "published_at" TIMESTAMP WITH TIME ZONE NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_0a6e2c450d83e0b6052c2793334" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_articles_url" ON "articles" ("url") `,
    );
    await queryRunner.query(
      `CREATE TABLE "issue_articles" ("issue_id" bigint NOT NULL, "article_id" bigint NOT NULL, CONSTRAINT "PK_f6dc6ab503bee77b9f8c0872150" PRIMARY KEY ("issue_id", "article_id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_issue_articles_article_id" ON "issue_articles" ("article_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "facts" ("id" BIGSERIAL NOT NULL, "issue_id" bigint NOT NULL, "article_id" bigint NOT NULL, "ai_text" text NOT NULL, "reviewed_text" text, "status" text NOT NULL DEFAULT 'pending', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "chk_facts_status" CHECK ("status" IN ('pending', 'approved', 'rejected')), CONSTRAINT "PK_b35218a44dc3d5dd2f0f54d7e3f" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_facts_article_id" ON "facts" ("article_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_facts_issue_id" ON "facts" ("issue_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "cards" ("id" BIGSERIAL NOT NULL, "issue_id" bigint NOT NULL, "summary" jsonb, "expressions" jsonb, "status" text NOT NULL, "fail_reason" text, "model" text NOT NULL, "generated_at" TIMESTAMP WITH TIME ZONE NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "chk_cards_ok_has_content" CHECK ("status" <> 'ok' OR ("summary" IS NOT NULL AND jsonb_array_length("summary") BETWEEN 1 AND 3 AND "expressions" IS NOT NULL AND jsonb_array_length("expressions") = 4)), CONSTRAINT "chk_cards_status" CHECK ("status" IN ('ok', 'failed')), CONSTRAINT "PK_5f3269634705fdff4a9935860fc" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_cards_issue_id" ON "cards" ("issue_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "card_articles" ("card_id" bigint NOT NULL, "article_id" bigint NOT NULL, "position" smallint NOT NULL, CONSTRAINT "chk_card_articles_position" CHECK ("position" BETWEEN 1 AND 3), CONSTRAINT "PK_19d079b265b10cb4fe3f920ee9a" PRIMARY KEY ("card_id", "article_id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_card_articles_article_id" ON "card_articles" ("article_id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_card_articles_card_position" ON "card_articles" ("card_id", "position") `,
    );
    await queryRunner.query(
      `ALTER TABLE "issues" ADD CONSTRAINT "FK_543a2cb1d3d734d91c3589bab1f" FOREIGN KEY ("run_date") REFERENCES "daily_runs"("run_date") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "issue_articles" ADD CONSTRAINT "FK_8a728c088ea4c10f229dce95674" FOREIGN KEY ("issue_id") REFERENCES "issues"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "issue_articles" ADD CONSTRAINT "FK_a3a46f9d52d24c6442adf19c0a4" FOREIGN KEY ("article_id") REFERENCES "articles"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "facts" ADD CONSTRAINT "FK_246adeaabc4d36c0de8cc2104e8" FOREIGN KEY ("issue_id") REFERENCES "issues"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "facts" ADD CONSTRAINT "FK_d6f26b4fd5b692e5fba95235221" FOREIGN KEY ("article_id") REFERENCES "articles"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "cards" ADD CONSTRAINT "FK_85a1e2d9b2da241a67a82c7cabd" FOREIGN KEY ("issue_id") REFERENCES "issues"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
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
      `ALTER TABLE "cards" DROP CONSTRAINT "FK_85a1e2d9b2da241a67a82c7cabd"`,
    );
    await queryRunner.query(
      `ALTER TABLE "facts" DROP CONSTRAINT "FK_d6f26b4fd5b692e5fba95235221"`,
    );
    await queryRunner.query(
      `ALTER TABLE "facts" DROP CONSTRAINT "FK_246adeaabc4d36c0de8cc2104e8"`,
    );
    await queryRunner.query(
      `ALTER TABLE "issue_articles" DROP CONSTRAINT "FK_a3a46f9d52d24c6442adf19c0a4"`,
    );
    await queryRunner.query(
      `ALTER TABLE "issue_articles" DROP CONSTRAINT "FK_8a728c088ea4c10f229dce95674"`,
    );
    await queryRunner.query(
      `ALTER TABLE "issues" DROP CONSTRAINT "FK_543a2cb1d3d734d91c3589bab1f"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."uq_card_articles_card_position"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_card_articles_article_id"`,
    );
    await queryRunner.query(`DROP TABLE "card_articles"`);
    await queryRunner.query(`DROP INDEX "public"."uq_cards_issue_id"`);
    await queryRunner.query(`DROP TABLE "cards"`);
    await queryRunner.query(`DROP INDEX "public"."idx_facts_issue_id"`);
    await queryRunner.query(`DROP INDEX "public"."idx_facts_article_id"`);
    await queryRunner.query(`DROP TABLE "facts"`);
    await queryRunner.query(
      `DROP INDEX "public"."idx_issue_articles_article_id"`,
    );
    await queryRunner.query(`DROP TABLE "issue_articles"`);
    await queryRunner.query(`DROP INDEX "public"."uq_articles_url"`);
    await queryRunner.query(`DROP TABLE "articles"`);
    await queryRunner.query(`DROP INDEX "public"."idx_issues_run_date"`);
    await queryRunner.query(
      `DROP INDEX "public"."uq_issues_run_category_rank"`,
    );
    await queryRunner.query(`DROP INDEX "public"."uq_issues_run_overall_rank"`);
    await queryRunner.query(`DROP TABLE "issues"`);
    await queryRunner.query(`DROP TABLE "daily_runs"`);
  }
}
