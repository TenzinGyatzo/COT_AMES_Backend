import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  OnModuleInit,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { User, UserDocument } from './schemas/user.schema';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { FilterUserDto } from './dto/filter-user.dto';
import { Roles } from '../auth/enums/roles.enum';
import { TenantsService } from '../tenants/tenants.service';
import { assertStrictObjectIdOrNotFound } from '../common/strict-object-id';

@Injectable()
export class UsersService implements OnModuleInit {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private readonly tenantsService: TenantsService,
  ) {}

  /** One-shot: legacy rol `admin` → `admin_sistema` (Story 1.3). */
  async onModuleInit() {
    const result = await this.userModel
      .updateMany({ rol: 'admin' }, { $set: { rol: Roles.ADMIN_SISTEMA } })
      .exec();
    if (result.modifiedCount > 0) {
      this.logger.log(
        `Migrated ${result.modifiedCount} user(s) rol admin → admin_sistema`,
      );
    }
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private escapeRegex(term: string): string {
    return term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private isDuplicateKeyError(err: unknown): boolean {
    return (
      typeof err === 'object' &&
      err !== null &&
      ((err as { code?: number | string }).code === 11000 ||
        (err as { code?: number | string }).code === 'E11000')
    );
  }

  private toResponse(user: UserDocument) {
    const obj = user.toObject();
    const { passwordHash: _, ...rest } = obj as any;
    return rest;
  }

  /** Impide dejar el sistema sin ningún admin_sistema activo. */
  private async assertNotRemovingLastActiveAdmin(
    current: UserDocument,
    opts: { nextRol?: string; nextActivo?: boolean },
  ): Promise<void> {
    if (current.rol !== Roles.ADMIN_SISTEMA || !current.activo) {
      return;
    }
    const demoting =
      opts.nextRol !== undefined && opts.nextRol !== Roles.ADMIN_SISTEMA;
    const deactivating = opts.nextActivo === false;
    if (!demoting && !deactivating) {
      return;
    }
    const activeAdmins = await this.userModel
      .countDocuments({ rol: Roles.ADMIN_SISTEMA, activo: true })
      .exec();
    if (activeAdmins <= 1) {
      throw new BadRequestException(
        'No se puede desactivar ni degradar el último administrador de sistema activo',
      );
    }
  }

  /** Valida reglas AD-8: operativo ↔ 1 tenant activo; admin sin tenant fijo. */
  private async resolveTenantForRole(
    rol: string,
    tenantId?: string | null,
  ): Promise<Types.ObjectId | undefined> {
    if (rol === Roles.ADMIN_SISTEMA) {
      if (tenantId) {
        throw new BadRequestException(
          'El administrador de sistema no puede tener tenant fijo',
        );
      }
      return undefined;
    }

    if (rol === Roles.OPERATIVO) {
      if (!tenantId) {
        throw new BadRequestException(
          'El usuario operativo requiere exactamente un tenantId',
        );
      }
      const tenant = await this.tenantsService.findById(tenantId);
      if (!tenant || !tenant.activo) {
        throw new BadRequestException('Tenant no encontrado o inactivo');
      }
      return tenant._id as Types.ObjectId;
    }

    throw new BadRequestException('Rol no válido');
  }

  async create(createUserDto: CreateUserDto): Promise<UserDocument> {
    const email = this.normalizeEmail(createUserDto.email);
    const rol = createUserDto.rol;
    if (!rol) {
      throw new BadRequestException('El rol es obligatorio');
    }

    const nombre = createUserDto.nombre.trim();
    if (!nombre) {
      throw new BadRequestException('El nombre es obligatorio');
    }

    const existingUser = await this.userModel.findOne({ email }).exec();
    if (existingUser) {
      throw new ConflictException('El email ya está registrado');
    }

    const tenantObjectId = await this.resolveTenantForRole(
      rol,
      createUserDto.tenantId,
    );

    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(createUserDto.password, saltRounds);

    const user = new this.userModel({
      email,
      passwordHash,
      nombre,
      rol,
      ...(tenantObjectId ? { tenantId: tenantObjectId } : {}),
      activo: true,
    });

    try {
      return await user.save();
    } catch (err) {
      if (this.isDuplicateKeyError(err)) {
        throw new ConflictException('El email ya está registrado');
      }
      throw err;
    }
  }

  async findAll(filters?: FilterUserDto): Promise<User[]> {
    const query: Record<string, unknown> = {};

    if (filters?.activo !== undefined) {
      query.activo = filters.activo;
    } else {
      query.activo = true;
    }

    if (filters?.rol) {
      query.rol = filters.rol;
    }

    if (filters?.search?.trim()) {
      const term = this.escapeRegex(filters.search.trim());
      query.$or = [
        { nombre: { $regex: term, $options: 'i' } },
        { email: { $regex: term.toLowerCase(), $options: 'i' } },
      ];
    }

    return await this.userModel
      .find(query)
      .sort({ nombre: 1 })
      .select('-passwordHash')
      .exec();
  }

  async findByEmail(email: string): Promise<UserDocument | null> {
    return await this.userModel
      .findOne({ email: this.normalizeEmail(email) })
      .exec();
  }

  async findByEmailWithPassword(email: string): Promise<UserDocument | null> {
    return await this.userModel
      .findOne({ email: this.normalizeEmail(email) })
      .select('+passwordHash')
      .exec();
  }

  async findById(id: string): Promise<UserDocument> {
    assertStrictObjectIdOrNotFound(id, 'Usuario');
    const user = await this.userModel.findById(id).exec();
    if (!user) {
      throw new NotFoundException(`Usuario con ID ${id} no encontrado`);
    }
    return user;
  }

  async update(
    id: string,
    updateUserDto: UpdateUserDto,
  ): Promise<UserDocument> {
    assertStrictObjectIdOrNotFound(id, 'Usuario');
    const current = await this.findById(id);

    const nextRol = updateUserDto.rol ?? current.rol;
    await this.assertNotRemovingLastActiveAdmin(current, {
      nextRol: updateUserDto.rol,
      nextActivo: updateUserDto.activo,
    });

    const tenantProvided = Object.prototype.hasOwnProperty.call(
      updateUserDto,
      'tenantId',
    );
    const nextTenantRaw = tenantProvided
      ? updateUserDto.tenantId
      : current.tenantId
        ? String(current.tenantId)
        : undefined;

    // Al pasar a admin, limpiar tenant aunque no venga en body.
    let resolvedTenant: Types.ObjectId | undefined | null;
    if (nextRol === Roles.ADMIN_SISTEMA) {
      await this.resolveTenantForRole(
        nextRol,
        tenantProvided ? updateUserDto.tenantId : null,
      );
      resolvedTenant = null; // $unset
    } else {
      resolvedTenant = await this.resolveTenantForRole(
        nextRol,
        nextTenantRaw === null ? undefined : nextTenantRaw,
      );
    }

    const setData: Record<string, unknown> = {};

    if (updateUserDto.nombre !== undefined) {
      const nombre = updateUserDto.nombre.trim();
      if (!nombre) {
        throw new BadRequestException('El nombre es obligatorio');
      }
      setData.nombre = nombre;
    }
    if (updateUserDto.rol !== undefined) {
      setData.rol = updateUserDto.rol;
    }
    if (updateUserDto.activo !== undefined) {
      setData.activo = updateUserDto.activo;
    }

    if (updateUserDto.password) {
      const saltRounds = 10;
      setData.passwordHash = await bcrypt.hash(
        updateUserDto.password,
        saltRounds,
      );
    }

    if (updateUserDto.email) {
      const email = this.normalizeEmail(updateUserDto.email);
      const existingUser = await this.userModel
        .findOne({ email, _id: { $ne: id } })
        .exec();
      if (existingUser) {
        throw new ConflictException('El email ya está registrado');
      }
      setData.email = email;
    }

    if (resolvedTenant === null) {
      // admin_sistema: sin tenant fijo
    } else if (resolvedTenant) {
      setData.tenantId = resolvedTenant;
    }

    const mongoUpdate: Record<string, unknown> = {};
    if (Object.keys(setData).length > 0) {
      mongoUpdate.$set = setData;
    }
    if (resolvedTenant === null) {
      mongoUpdate.$unset = { tenantId: 1 };
    }

    if (Object.keys(mongoUpdate).length === 0) {
      return current;
    }

    let updatedUser: UserDocument | null;
    try {
      updatedUser = await this.userModel
        .findByIdAndUpdate(id, mongoUpdate, { new: true })
        .exec();
    } catch (err) {
      if (this.isDuplicateKeyError(err)) {
        throw new ConflictException('El email ya está registrado');
      }
      throw err;
    }

    if (!updatedUser) {
      throw new NotFoundException(`Usuario con ID ${id} no encontrado`);
    }

    return updatedUser;
  }

  async softDelete(id: string): Promise<UserDocument> {
    assertStrictObjectIdOrNotFound(id, 'Usuario');
    const user = await this.findById(id);
    await this.assertNotRemovingLastActiveAdmin(user, { nextActivo: false });
    user.activo = false;
    return await user.save();
  }

  async count(): Promise<number> {
    return await this.userModel.countDocuments().exec();
  }

  /**
   * Story 7.3 — operativos activos del tenant (excluye admin_sistema).
   */
  async countOperativosByTenant(tenantId: Types.ObjectId): Promise<number> {
    return this.userModel
      .countDocuments({
        rol: Roles.OPERATIVO,
        tenantId,
        activo: { $ne: false },
      })
      .exec();
  }

  /** Helper para controllers: documento sin passwordHash. */
  sanitize(user: UserDocument) {
    return this.toResponse(user);
  }
}
