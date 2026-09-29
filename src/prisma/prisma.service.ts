import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { autoSeedDatabase, syncAllEmployeeCodeSequences } from './seed-data';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    await this.$connect();

    if (process.env.NODE_ENV !== 'test') {
      try {
        const userCount = await this.user.count();
        if (userCount === 0) {
          this.logger.log('Database empty on startup. Automatically seeding initial organization & demo accounts...');
          await autoSeedDatabase(this);
          this.logger.log('Database auto-seeded successfully.');
        } else {
          // Keep employee sequential counters in sync with current employees
          await syncAllEmployeeCodeSequences(this);
        }
      } catch (err: any) {
        this.logger.warn(`Startup DB check skipped or encountered error: ${err.message}`);
      }
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
