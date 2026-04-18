import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AppConfigService, SUPPORTED_CURRENCIES } from './app-config.service';

describe('AppConfigService', () => {
  let service: AppConfigService;

  const mockConfigService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppConfigService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<AppConfigService>(AppConfigService);
    jest.clearAllMocks();
  });

  describe('getConfig', () => {
    it('should return EUR as default currency when env is set to EUR', () => {
      mockConfigService.get.mockReturnValue('EUR');

      const result = service.getConfig();

      expect(result.defaultCurrency).toBe('EUR');
    });

    it('should return the configured currency from env', () => {
      mockConfigService.get.mockReturnValue('GBP');

      const result = service.getConfig();

      expect(result.defaultCurrency).toBe('GBP');
      expect(mockConfigService.get).toHaveBeenCalledWith(
        'DEFAULT_CURRENCY',
        'EUR',
      );
    });

    it('should fall back to EUR when DEFAULT_CURRENCY is not set', () => {
      mockConfigService.get.mockImplementation(
        (_key: string, defaultValue: string) => defaultValue,
      );

      const result = service.getConfig();

      expect(result.defaultCurrency).toBe('EUR');
    });

    it('should return the SUPPORTED_CURRENCIES list', () => {
      mockConfigService.get.mockReturnValue('EUR');

      const result = service.getConfig();

      expect(result.supportedCurrencies).toEqual([...SUPPORTED_CURRENCIES]);
    });

    it('should return a copy of SUPPORTED_CURRENCIES (spread prevents mutation)', () => {
      mockConfigService.get.mockReturnValue('EUR');

      const result = service.getConfig();

      // Mutating the result should not affect SUPPORTED_CURRENCIES
      result.supportedCurrencies.push('XYZ');
      expect(SUPPORTED_CURRENCIES).not.toContain('XYZ');
    });
  });
});
