import { SetMetadata } from '@nestjs/common';
import { Role } from '@ventry/database';

export const Roles = (...roles: Role[]) => SetMetadata('roles', roles);