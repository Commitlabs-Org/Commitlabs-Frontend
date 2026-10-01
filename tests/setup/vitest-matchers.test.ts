import { describe, expect, it } from 'vitest';

describe('Custom Vitest Matchers', () => {
  describe('toStartWith', () => {
    it('passes when string starts with the expected prefix', () => {
      expect('commitlabs-frontend').toStartWith('commitlabs');
    });

    it('passes when expected prefix is an empty string', () => {
      expect('commitlabs-frontend').toStartWith('');
      expect('').toStartWith('');
    });

    it('passes with negated matcher when string does not start with prefix', () => {
      expect('commitlabs-frontend').not.toStartWith('frontend');
    });

    it('fails when string does not start with prefix', () => {
      let threw = false;
      try {
        expect('commitlabs-frontend').toStartWith('backend');
      } catch (err) {
        threw = true;
        expect((err as Error).message).toContain(
          'expected "commitlabs-frontend" to start with "backend"',
        );
      }
      expect(threw).toBe(true);
    });

    it('fails when negated matcher starts with prefix', () => {
      let threw = false;
      try {
        expect('commitlabs-frontend').not.toStartWith('commitlabs');
      } catch (err) {
        threw = true;
        expect((err as Error).message).toContain(
          'expected "commitlabs-frontend" not to start with "commitlabs"',
        );
      }
      expect(threw).toBe(true);
    });

    it('fails when received is null or undefined', () => {
      let threwNull = false;
      try {
        expect(null).toStartWith('test');
      } catch (err) {
        threwNull = true;
        expect((err as Error).message).toContain(
          'expected received value to be a string starting with "test", but received null',
        );
      }
      expect(threwNull).toBe(true);

      let threwUndefined = false;
      try {
        expect(undefined).toStartWith('test');
      } catch (err) {
        threwUndefined = true;
        expect((err as Error).message).toContain(
          'expected received value to be a string starting with "test", but received undefined',
        );
      }
      expect(threwUndefined).toBe(true);
    });

    it('fails when received is a number or boolean or object', () => {
      let threwNumber = false;
      try {
        expect(12345).toStartWith('12');
      } catch (err) {
        threwNumber = true;
        expect((err as Error).message).toContain(
          'expected received value to be a string starting with "12", but received number',
        );
      }
      expect(threwNumber).toBe(true);

      let threwObj = false;
      try {
        expect({ foo: 'bar' }).toStartWith('foo');
      } catch (err) {
        threwObj = true;
        expect((err as Error).message).toContain(
          'expected received value to be a string starting with "foo", but received object',
        );
      }
      expect(threwObj).toBe(true);
    });

    it('works as an asymmetric matcher inside an object', () => {
      expect({ name: 'commitlabs-v2' }).toEqual({
        name: expect.toStartWith('commitlabs'),
      });
    });
  });

  describe('toEndWith', () => {
    it('passes when string ends with the expected suffix', () => {
      expect('commitlabs-frontend').toEndWith('frontend');
    });

    it('passes when expected suffix is an empty string', () => {
      expect('commitlabs-frontend').toEndWith('');
      expect('').toEndWith('');
    });

    it('passes with negated matcher when string does not end with suffix', () => {
      expect('commitlabs-frontend').not.toEndWith('commitlabs');
    });

    it('fails when string does not end with suffix', () => {
      let threw = false;
      try {
        expect('commitlabs-frontend').toEndWith('backend');
      } catch (err) {
        threw = true;
        expect((err as Error).message).toContain(
          'expected "commitlabs-frontend" to end with "backend"',
        );
      }
      expect(threw).toBe(true);
    });

    it('fails when negated matcher ends with suffix', () => {
      let threw = false;
      try {
        expect('commitlabs-frontend').not.toEndWith('frontend');
      } catch (err) {
        threw = true;
        expect((err as Error).message).toContain(
          'expected "commitlabs-frontend" not to end with "frontend"',
        );
      }
      expect(threw).toBe(true);
    });

    it('fails when received is null or undefined', () => {
      let threwNull = false;
      try {
        expect(null).toEndWith('test');
      } catch (err) {
        threwNull = true;
        expect((err as Error).message).toContain(
          'expected received value to be a string ending with "test", but received null',
        );
      }
      expect(threwNull).toBe(true);

      let threwUndefined = false;
      try {
        expect(undefined).toEndWith('test');
      } catch (err) {
        threwUndefined = true;
        expect((err as Error).message).toContain(
          'expected received value to be a string ending with "test", but received undefined',
        );
      }
      expect(threwUndefined).toBe(true);
    });

    it('fails when received is a number or boolean or object', () => {
      let threwNumber = false;
      try {
        expect(12345).toEndWith('45');
      } catch (err) {
        threwNumber = true;
        expect((err as Error).message).toContain(
          'expected received value to be a string ending with "45", but received number',
        );
      }
      expect(threwNumber).toBe(true);
    });

    it('works as an asymmetric matcher inside an object', () => {
      expect({ path: '/api/commitments' }).toEqual({
        path: expect.toEndWith('/commitments'),
      });
    });
  });
});
