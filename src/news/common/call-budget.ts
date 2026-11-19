// 실행 1회의 NAVER API 호출 예산. tryAcquire 는 동기라 병렬 수집에서도 한도를 넘지 않는다
export class CallBudget {
  private count = 0;

  constructor(readonly limit: number) {}

  get used(): number {
    return this.count;
  }

  get exhausted(): boolean {
    return this.count >= this.limit;
  }

  tryAcquire(): boolean {
    if (this.exhausted) return false;
    this.count++;
    return true;
  }
}
