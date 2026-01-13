import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { Cliente, ClienteDocument } from './schemas/cliente.schema';
import {
  UsuarioCliente,
  UsuarioClienteDocument,
} from './schemas/usuario-cliente.schema';
import { CreateClienteDto } from './dto/create-cliente.dto';
import { UpdateClienteDto } from './dto/update-cliente.dto';
import { FilterClienteDto } from './dto/filter-cliente.dto';
import { CreateUsuarioClienteDto } from './dto/create-usuario-cliente.dto';
import { RegisterClienteCompletoDto } from './dto/register-cliente-completo.dto';
import { SedesService } from '../sedes/sedes.service';

@Injectable()
export class ClientesService {
  constructor(
    @InjectModel(Cliente.name) private clienteModel: Model<ClienteDocument>,
    @InjectModel(UsuarioCliente.name)
    private usuarioClienteModel: Model<UsuarioClienteDocument>,
    private sedesService: SedesService,
  ) {}

  /**
   * Genera una clave única para el cliente
   * Formato: 8 caracteres alfanuméricos en mayúsculas
   */
  private async generateClave(): Promise<string> {
    let clave: string;
    let existe: boolean;

    do {
      // Generar 8 caracteres alfanuméricos aleatorios
      clave = crypto.randomBytes(4).toString('hex').toUpperCase();
      existe = (await this.clienteModel.findOne({ clave }).exec()) !== null;
    } while (existe);

    return clave;
  }

  async create(createClienteDto: CreateClienteDto): Promise<Cliente> {
    // Validar que empresa esté presente
    if (!createClienteDto.empresa) {
      throw new BadRequestException(
        'Debe proporcionar el nombre de la empresa',
      );
    }

    // Si se proporciona sedeId, validar que exista
    if (createClienteDto.sedeId) {
      await this.sedesService.findOne(createClienteDto.sedeId);
    }

    try {
      // Generar clave única si no se proporciona
      const clave = createClienteDto.clave || (await this.generateClave());

      const cliente = new this.clienteModel({
        ...createClienteDto,
        clave,
      });
      return await cliente.save();
    } catch {
      throw new BadRequestException('Error al crear el cliente');
    }
  }

  async findAll(filters?: FilterClienteDto): Promise<any[]> {
    const matchConditions: any = { activo: true };

    if (filters?.empresa) {
      matchConditions.empresa = { $regex: filters.empresa, $options: 'i' };
    }

    if (filters?.rfc) {
      matchConditions.rfc = { $regex: filters.rfc, $options: 'i' };
    }

    // Usar agregación para incluir conteos
    const clientes = await this.clienteModel.aggregate([
      {
        $match: matchConditions,
      },
      {
        $lookup: {
          from: 'sedes',
          localField: 'sedeId',
          foreignField: '_id',
          as: 'sedeArray',
        },
      },
      {
        $lookup: {
          from: 'usuarioclientes',
          localField: '_id',
          foreignField: 'clienteId',
          as: 'usuarios',
        },
      },
      {
        $lookup: {
          from: 'cotizacions',
          localField: '_id',
          foreignField: 'clienteId',
          as: 'cotizaciones',
        },
      },
      {
        $lookup: {
          from: 'ordentrabajos',
          localField: '_id',
          foreignField: 'clienteId',
          as: 'ordenesTrabajo',
        },
      },
      {
        $addFields: {
          totalUsuarios: { $size: '$usuarios' },
          totalCotizaciones: { $size: '$cotizaciones' },
          totalOrdenesTrabajo: { $size: '$ordenesTrabajo' },
          sedeId: {
            $cond: {
              if: { $gt: [{ $size: '$sedeArray' }, 0] },
              then: { $arrayElemAt: ['$sedeArray', 0] },
              else: '$sedeId',
            },
          },
        },
      },
      {
        $project: {
          usuarios: 0,
          cotizaciones: 0,
          ordenesTrabajo: 0,
          sedeArray: 0,
        },
      },
    ]);

    return clientes;
  }

  async findOne(id: string): Promise<Cliente> {
    const cliente = await this.clienteModel
      .findById(id)
      .populate('sedeId')
      .exec();
    if (!cliente) {
      throw new NotFoundException(`Cliente con ID ${id} no encontrado`);
    }
    return cliente;
  }

  async update(
    id: string,
    updateClienteDto: UpdateClienteDto,
  ): Promise<Cliente> {
    // Si se actualiza sedeId, validar que exista
    if (updateClienteDto.sedeId) {
      await this.sedesService.findOne(updateClienteDto.sedeId);
    }

    // Validar que empresa esté presente si se actualiza
    const cliente = await this.clienteModel.findById(id).exec();
    if (!cliente) {
      throw new NotFoundException(`Cliente con ID ${id} no encontrado`);
    }
    const updatedData = { ...cliente.toObject(), ...updateClienteDto };
    if (!updatedData.empresa) {
      throw new BadRequestException('Debe mantener el nombre de la empresa');
    }

    const updatedCliente = await this.clienteModel
      .findByIdAndUpdate(id, updateClienteDto, { new: true })
      .populate('sedeId')
      .exec();
    if (!updatedCliente) {
      throw new NotFoundException(`Cliente con ID ${id} no encontrado`);
    }
    return updatedCliente;
  }

  async remove(id: string): Promise<Cliente> {
    const cliente = await this.clienteModel.findById(id).exec();
    if (!cliente) {
      throw new NotFoundException(`Cliente con ID ${id} no encontrado`);
    }
    cliente.activo = false;
    return await cliente.save();
  }

  async findByRfc(rfc: string): Promise<Cliente | null> {
    return await this.clienteModel.findOne({ rfc: rfc.toUpperCase() }).exec();
  }

  async findByClave(clave: string): Promise<Cliente | null> {
    return await this.clienteModel.findOne({ clave }).exec();
  }

  async findByEmpresa(empresa: string): Promise<Cliente | null> {
    return await this.clienteModel
      .findOne({ empresa: empresa.trim(), activo: true })
      .exec();
  }

  async findOrCreateByRfc(
    rfc: string,
    datosCliente?: Partial<Cliente>,
  ): Promise<Cliente> {
    const rfcUpper = rfc.toUpperCase();
    let cliente = await this.findByRfc(rfcUpper);

    if (cliente) {
      // Actualizar datos básicos si cambiaron
      const datosActualizar: any = {};
      if (datosCliente?.empresa && datosCliente.empresa !== cliente.empresa) {
        datosActualizar.empresa = datosCliente.empresa;
      }
      if (
        datosCliente?.sedeId &&
        datosCliente.sedeId.toString() !== cliente.sedeId?.toString()
      ) {
        datosActualizar.sedeId = datosCliente.sedeId;
      }

      if (Object.keys(datosActualizar).length > 0) {
        const clienteDoc = cliente as any;
        cliente = await this.clienteModel
          .findByIdAndUpdate(clienteDoc._id || clienteDoc.id, datosActualizar, {
            new: true,
          })
          .exec();
      }
      return cliente;
    }

    // Crear nuevo cliente con clave única
    const clave = await this.generateClave();
    const nuevoCliente = new this.clienteModel({
      rfc: rfcUpper,
      clave,
      empresa: datosCliente?.empresa || 'Empresa sin nombre',
      sedeId: datosCliente?.sedeId,
      activo: true,
    });

    return await nuevoCliente.save();
  }

  async createUsuarioCliente(
    createDto: CreateUsuarioClienteDto,
  ): Promise<UsuarioCliente> {
    // Verificar que el clienteId exista
    await this.findOne(createDto.clienteId);

    // Verificar si el email ya existe
    const existingUsuario = await this.usuarioClienteModel
      .findOne({ email: createDto.email })
      .exec();
    if (existingUsuario) {
      throw new ConflictException('El email ya está registrado');
    }

    // Hashear la contraseña
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(createDto.password, saltRounds);

    // Crear el usuario cliente
    const usuarioCliente = new this.usuarioClienteModel({
      email: createDto.email,
      passwordHash,
      nombre: createDto.nombre,
      telefono: createDto.telefono,
      clienteId: createDto.clienteId,
      activo: true,
    });

    return await usuarioCliente.save();
  }

  /**
   * Registra un cliente completo: busca o crea el cliente y luego crea el usuario cliente
   * Este método facilita el registro de nuevos clientes sin necesidad de tener clienteId previo
   *
   * Si se proporciona claveEmpresa, busca un Cliente existente con esa clave y asocia
   * el nuevo usuario a ese Cliente. Si no se encuentra, lanza un error.
   *
   * Si no se proporciona claveEmpresa, busca o crea un nuevo Cliente (comportamiento original).
   */
  async registerClienteCompleto(
    registerDto: RegisterClienteCompletoDto,
  ): Promise<UsuarioCliente> {
    // Verificar si el email del usuario ya está registrado
    const existingUsuario = await this.usuarioClienteModel
      .findOne({ email: registerDto.email })
      .exec();
    if (existingUsuario) {
      throw new ConflictException('El email ya está registrado');
    }

    let cliente: Cliente;

    // Si se proporciona claveEmpresa, buscar Cliente existente
    if (registerDto.claveEmpresa) {
      cliente = await this.findByClave(registerDto.claveEmpresa.toUpperCase());

      if (!cliente) {
        throw new NotFoundException(
          `No se encontró una empresa con la clave ${registerDto.claveEmpresa}. Verifica la clave o contacta al administrador.`,
        );
      }

      // Verificar que el cliente esté activo
      if (!cliente.activo) {
        throw new BadRequestException(
          'La empresa asociada a esta clave está inactiva. Contacta al administrador.',
        );
      }
    } else {
      // Comportamiento original: buscar o crear el cliente
      // Validar que se proporcione RFC para crear nueva empresa
      if (!registerDto.rfc) {
        throw new BadRequestException(
          'Debe proporcionar el RFC de la empresa para crear una nueva empresa',
        );
      }

      // Buscar o crear el cliente usando findOrCreateByRfc
      cliente = await this.findOrCreateByRfc(registerDto.rfc, {
        empresa: registerDto.empresa || 'Empresa sin nombre',
        sedeId: registerDto.sedeId ? (registerDto.sedeId as any) : undefined,
      });

      // Validar que el cliente tenga empresa
      if (!cliente.empresa) {
        const clienteDoc = cliente as any;
        cliente = await this.clienteModel
          .findByIdAndUpdate(
            clienteDoc._id || clienteDoc.id,
            { empresa: registerDto.empresa || 'Empresa sin nombre' },
            { new: true },
          )
          .exec();
        if (!cliente) {
          throw new NotFoundException(
            'Cliente no encontrado después de actualización',
          );
        }
      }
    }

    // Hashear la contraseña
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(registerDto.password, saltRounds);

    // Crear el usuario cliente asociado al cliente encontrado/creado
    const clienteDoc = cliente as any;
    const usuarioCliente = new this.usuarioClienteModel({
      email: registerDto.email,
      passwordHash,
      nombre: registerDto.nombre,
      telefono: registerDto.telefono,
      clienteId: clienteDoc._id || clienteDoc.id,
      activo: true,
    });

    return await usuarioCliente.save();
  }

  async findUsuarioClienteByEmail(
    email: string,
  ): Promise<UsuarioCliente | null> {
    return await this.usuarioClienteModel.findOne({ email }).exec();
  }

  async findUsuarioClienteByEmailWithPassword(
    email: string,
  ): Promise<UsuarioClienteDocument | null> {
    // Necesario para validar contraseñas debido a select: false
    return await this.usuarioClienteModel
      .findOne({ email })
      .select('+passwordHash')
      .exec();
  }

  async validateUsuarioCliente(email: string, password: string): Promise<any> {
    const usuarioCliente =
      await this.findUsuarioClienteByEmailWithPassword(email);

    if (!usuarioCliente) {
      return null;
    }

    // Verificar que el usuario esté activo
    if (!usuarioCliente.activo) {
      return null;
    }

    // Comparar contraseñas
    const isPasswordValid = await bcrypt.compare(
      password,
      usuarioCliente.passwordHash,
    );
    if (!isPasswordValid) {
      return null;
    }

    // Devolver usuario sin passwordHash (similar a UsersService.validateUser)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash, ...result } = usuarioCliente.toObject();
    return result;
  }

  async findUsuariosByClienteId(clienteId: string): Promise<any[]> {
    // Validar que el cliente existe primero
    await this.findOne(clienteId);

    // Convertir el string a ObjectId para la búsqueda
    const objectId = new Types.ObjectId(clienteId);

    // Usar agregación para incluir conteos de cotizaciones y órdenes de trabajo
    const usuarios = await this.usuarioClienteModel.aggregate([
      {
        $match: {
          clienteId: objectId,
          activo: true,
        },
      },
      {
        $lookup: {
          from: 'cotizacions',
          localField: '_id',
          foreignField: 'usuarioClienteId',
          as: 'cotizaciones',
        },
      },
      {
        $lookup: {
          from: 'ordentrabajos',
          localField: '_id',
          foreignField: 'usuarioClienteId',
          as: 'ordenesTrabajo',
        },
      },
      {
        $addFields: {
          totalCotizaciones: { $size: '$cotizaciones' },
          totalOrdenesTrabajo: { $size: '$ordenesTrabajo' },
        },
      },
      {
        $project: {
          cotizaciones: 0,
          ordenesTrabajo: 0,
        },
      },
    ]);

    return usuarios;
  }

  async findUsuarioClienteById(id: string): Promise<UsuarioClienteDocument> {
    const usuarioCliente = await this.usuarioClienteModel.findById(id).exec();
    if (!usuarioCliente) {
      throw new NotFoundException(`Usuario cliente con ID ${id} no encontrado`);
    }
    return usuarioCliente;
  }

  async updateUsuarioCliente(
    id: string,
    data: Partial<UsuarioCliente>,
  ): Promise<UsuarioClienteDocument> {
    // Validar que el usuario existe
    const usuarioCliente = await this.findUsuarioClienteById(id);

    // Si se actualiza el email, verificar que no esté usado por otro usuario
    if (data.email && data.email !== usuarioCliente.email) {
      const existingUsuario = await this.usuarioClienteModel
        .findOne({ email: data.email, _id: { $ne: id } })
        .exec();
      if (existingUsuario) {
        throw new ConflictException('El email ya está registrado');
      }
    }

    // No permitir cambiar clienteId
    const updateData: any = { ...data };
    delete updateData.clienteId;

    const updatedUsuario = await this.usuarioClienteModel
      .findByIdAndUpdate(id, updateData, { new: true })
      .exec();

    if (!updatedUsuario) {
      throw new NotFoundException(`Usuario cliente con ID ${id} no encontrado`);
    }

    return updatedUsuario;
  }

  async updateUsuarioClientePassword(
    id: string,
    newPassword: string,
  ): Promise<void> {
    const usuarioCliente = await this.findUsuarioClienteById(id);

    if (!usuarioCliente) {
      throw new NotFoundException(`Usuario cliente con ID ${id} no encontrado`);
    }

    // Hashear la nueva contraseña
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(newPassword, saltRounds);

    // Actualizar solo el passwordHash
    await this.usuarioClienteModel
      .findByIdAndUpdate(id, { passwordHash })
      .exec();
  }
}
