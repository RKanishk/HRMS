import {
  type ArgumentMetadata,
  BadRequestException,
  Injectable,
  PipeTransform,
} from '@nestjs/common';
@Injectable()
export class InputSafetyPipe implements PipeTransform {
  transform(value: unknown, metadata: ArgumentMetadata) {
    // Custom decorators provide internal values, such as the authenticated user.
    if (metadata.type === 'custom') return value;
    const visit = (v: unknown, depth: number) => {
      if (depth > 15) throw new BadRequestException('Input nesting is too deep');
      if (v === null) throw new BadRequestException('Null is not accepted; omit optional fields');
      if (typeof v === 'string' && /[\x00\x08\x0b\x0c\x0e-\x1f]/.test(v))
        throw new BadRequestException('Control characters are not accepted');
      if (Array.isArray(v)) for (const x of v) visit(x, depth + 1);
      else if (v && typeof v === 'object' && !(v instanceof Date))
        for (const x of Object.values(v)) visit(x, depth + 1);
    };
    visit(value, 0);
    return value;
  }
}
