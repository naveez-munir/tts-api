import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';

@Injectable()
export class SystemSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get a single setting by key
   * Returns the parsed value based on dataType
   */
  async getSetting(key: string): Promise<any> {
    const setting = await this.prisma.systemSetting.findUnique({
      where: { key, isActive: true },
    });

    if (!setting) {
      throw new NotFoundException(`System setting '${key}' not found`);
    }

    return this.parseValue(setting.value, setting.dataType);
  }

  /**
   * Get a setting with a fallback value if not found
   */
  async getSettingOrDefault(key: string, defaultValue: any): Promise<any> {
    try {
      return await this.getSetting(key);
    } catch (error) {
      return defaultValue;
    }
  }

  /**
   * Get all settings by category
   */
  async getSettingsByCategory(category: string) {
    const settings = await this.prisma.systemSetting.findMany({
      where: { category, isActive: true },
      orderBy: { key: 'asc' },
    });

    return settings.map((s) => ({
      id: s.id,
      key: s.key,
      value: this.parseValue(s.value, s.dataType),
      rawValue: s.value,
      dataType: s.dataType,
      description: s.description,
    }));
  }

  /**
   * Get all settings grouped by category
   */
  async getAllSettings() {
    const settings = await this.prisma.systemSetting.findMany({
      where: { isActive: true },
      orderBy: [{ category: 'asc' }, { key: 'asc' }],
    });

    const grouped: Record<string, any[]> = {};

    settings.forEach((s) => {
      if (!grouped[s.category]) {
        grouped[s.category] = [];
      }
      grouped[s.category].push({
        id: s.id,
        key: s.key,
        value: this.parseValue(s.value, s.dataType),
        rawValue: s.value,
        dataType: s.dataType,
        description: s.description,
      });
    });

    return grouped;
  }

  /**
   * Update a setting value
   */
  async updateSetting(key: string, value: any): Promise<void> {
    const setting = await this.prisma.systemSetting.findUnique({
      where: { key },
    });

    if (!setting) {
      throw new NotFoundException(`System setting '${key}' not found`);
    }

    // Convert value to string based on dataType
    const stringValue = this.stringifyValue(value, setting.dataType);

    await this.prisma.systemSetting.update({
      where: { key },
      data: { value: stringValue },
    });
  }

  /**
   * Bulk update multiple settings
   */
  async bulkUpdateSettings(updates: Array<{ key: string; value: any }>): Promise<void> {
    for (const update of updates) {
      await this.updateSetting(update.key, update.value);
    }
  }

  /**
   * Parse value from string based on dataType
   */
  private parseValue(value: string, dataType: string): any {
    switch (dataType) {
      case 'NUMBER':
        return parseFloat(value);
      case 'BOOLEAN':
        return value === 'true';
      case 'JSON':
        return JSON.parse(value);
      case 'STRING':
      case 'TIME':
      default:
        return value;
    }
  }

  /**
   * Convert value to string based on dataType
   */
  private stringifyValue(value: any, dataType: string): string {
    switch (dataType) {
      case 'NUMBER':
      case 'BOOLEAN':
        return String(value);
      case 'JSON':
        return JSON.stringify(value);
      case 'STRING':
      case 'TIME':
      default:
        return value;
    }
  }
}

